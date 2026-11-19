import 'server-only';
import {unstable_cache} from 'next/cache';
import snapshot from '../data/luma-events.json';
import registry from '../data/luma-sources.json';
import {combineLuma, parseLuma, type LumaImport, type LumaSource} from './luma-import';

const HOUR = 3600;
const MAX_BYTES = 8_000_000;
type SyncState = {inflight: Map<string, Promise<LumaImport>>; retryAfter: Map<string, number>; deadlines: WeakMap<LumaSource, number>; blockedUntil: number; networkQueue: Promise<unknown>};
// Route handlers and server components can have separate module instances.
const shared = globalThis as typeof globalThis & {__supanautsLumaSync?: SyncState};
const state = shared.__supanautsLumaSync ??= {inflight: new Map(), retryAfter: new Map(), deadlines: new WeakMap(), blockedUntil: 0, networkQueue: Promise.resolve()};

async function download(source: LumaSource): Promise<LumaImport> {
  const existing = state.inflight.get(source.url);
  if (existing) return existing;
  const queuedAt = Date.now();
  // Next may revalidate several stale entries in the background. Serialize their
  // network work too, so cached requests cannot turn an hourly refresh into a burst.
  const task = state.networkQueue.then(async () => {
    if (Date.now() - queuedAt > 20_000 || Date.now() > (state.deadlines.get(source) || Infinity)) throw new Error('Luma refresh deferred after request budget');
    if (Date.now() < Math.max(state.blockedUntil, state.retryAfter.get(source.url) || 0)) throw new Error('Luma refresh deferred during source cooldown');
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.username || url.password || !['luma.com', 'api.lu.ma'].includes(url.hostname)) throw new Error('Unsupported Luma source');
    try {
      const response = await fetch(source.url, {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000), headers: {Accept: source.kind === 'feed' ? 'text/calendar' : 'text/html'}});
      if (!response.ok) {
        if ([403, 429].includes(response.status)) {
          const retry = response.headers.get('retry-after');
          const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 0;
          state.blockedUntil = Date.now() + Math.max(HOUR * 1000, Number.isFinite(delay) ? delay : 0);
        }
        throw new Error(`Luma HTTP ${response.status}`);
      }
      if (!response.body) throw new Error('Empty Luma response');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) throw new Error('Luma response exceeds size limit');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      return parseLuma(Buffer.concat(chunks).toString('utf8'), source, new Date().toISOString());
    } catch (error) {
      state.retryAfter.set(source.url, Date.now() + 15 * 60_000);
      throw error;
    }
  });
  state.networkQueue = task.catch(() => undefined);
  state.inflight.set(source.url, task);
  try { return await task; } finally { state.inflight.delete(source.url); }
}

// Cache parsed public facts, never the raw HTML (which may contain guest information).
// Throwing preserves Next's last successful cache entry on failed revalidation.
// A bound function has a stable representation across separately minified route
// bundles. The explicit version plus source arguments identify the cache entry.
// Bump the version when changing the stored metadata contract.
const cachedSource = unstable_cache(download.bind(null), ['supanauts-luma-public-v1'], {revalidate: HOUR, tags: ['luma-calendar']});
// Read the same source key without refreshing old events. A cold archive entry
// contains no override; a previously verified private event retains its removal.
const cachedArchive = unstable_cache((async (_source: LumaSource): Promise<LumaImport> => ({checkedAt: snapshot.updatedAt, events: [], removed: [], hasMore: false})).bind(null),
  // Use an explicit long lifetime: this Next version falls back to the stored
  // hourly TTL when a reader passes false for an existing cache entry.
  ['supanauts-luma-public-v1'], {revalidate: 2_147_483_647, tags: ['luma-calendar']});

export async function lumaCalendar() {
  const enabled = process.env.LUMA_SYNC_ENABLED !== 'false';
  if (!enabled) return {events: snapshot.events, updatedAt: snapshot.updatedAt, enabled, delayed: 0, limited: false, incomplete: false};
  const imports: {source: LumaSource; data: LumaImport}[] = [];
  let delayed = 0;
  let incomplete = false;
  const now = Date.now();
  let budgetReached = false;
  async function read(source: LumaSource) {
    if (Date.now() - now > 20_000) budgetReached = true;
    // Apply the deadline only to outbound work. Even after it expires, read
    // existing cache entries so their events and privacy removals are retained.
    state.deadlines.set(source, now + 20_000);
    try {
      const data = await cachedSource(source);
      imports.push({source, data});
      if (now - Date.parse(data.checkedAt) > (HOUR + 300) * 1000) delayed++;
    } catch { delayed++; incomplete = true; }
  }
  // Run serially so a 403/429 stops further outbound requests in this process.
  for (const calendar of registry.calendars) {
    await read({kind: 'feed', name: calendar.name, url: `https://api.lu.ma/ics/get?entity=calendar&id=${encodeURIComponent(calendar.id)}`});
    await read({kind: 'calendar', name: calendar.name, url: calendar.url});
  }
  imports.sort((a, b) => Number(a.source.kind !== 'feed') - Number(b.source.kind !== 'feed'));
  const discovered = combineLuma(snapshot.events, imports, registry.aliases, registry.onlineEvents, registry.scheduleNotes);
  // Recent events are rechecked too, so cancellations and late schedule changes propagate.
  const active = discovered.filter(event => Date.parse(event.endsAt) > now - 7 * 86400_000);
  const known = new Map(discovered.map(event => [event.url, event]));
  const candidates = [...new Set([...active.map(event => event.url), ...registry.events.map(slug => `https://luma.com/${slug}`).filter(url => !known.has(url))])];
  // Bound each refresh; rotate overflow deterministically to avoid starving later listings.
  const limit = 24, offset = candidates.length > limit ? (Math.floor(now / (HOUR * 1000)) * limit) % candidates.length : 0;
  const selected = [...candidates.slice(offset), ...candidates.slice(0, offset)].slice(0, limit);
  // Read previous results for everything outside this batch without outbound
  // requests. Privacy removals must survive both aging and batch rotation.
  const archived = await Promise.all(discovered.filter(event => !selected.includes(event.url)).map(async event => {
    const source: LumaSource = {kind: 'event', name: event.source, url: event.url};
    return {source, data: await cachedArchive(source)};
  }));
  imports.push(...archived);
  for (const url of selected) await read({kind: 'event', name: known.get(url)?.source || 'Independent organizer', url});
  const events = combineLuma(snapshot.events, imports, registry.aliases, registry.onlineEvents, registry.scheduleNotes);
  const latest = imports.map(item => item.data.checkedAt).sort().at(-1);
  return {events, updatedAt: latest || snapshot.updatedAt, enabled, delayed, incomplete, limited: budgetReached || candidates.length > limit || imports.some(item => item.data.hasMore)};
}
