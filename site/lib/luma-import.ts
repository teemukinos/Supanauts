import type {CalendarEvent} from './calendar';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const slugPattern = /^[a-zA-Z0-9_-]+$/;
export type LumaSource = {url: string; name: string; kind: 'calendar' | 'feed' | 'event'};
export type LumaImport = {checkedAt: string; events: CalendarEvent[]; removed: {id: string; url: string}[]; hasMore: boolean};

function eventFromPage(value: unknown, source: string, checkedAt: string): CalendarEvent | null {
  const event = record(value);
  if (!text(event.api_id) || !slugPattern.test(text(event.url))) throw new Error('Invalid public event metadata');
  if (!['public', 'private', 'unlisted'].includes(text(event.visibility))) throw new Error('Unknown event visibility');
  if (event.visibility !== 'public') return null;
  const start = text(event.start_at), end = text(event.end_at);
  if (!/(Z|[+-]\d\d:\d\d)$/.test(start) || !/(Z|[+-]\d\d:\d\d)$/.test(end) || !Number.isFinite(Date.parse(start)) || !(Date.parse(end) > Date.parse(start)) || !text(event.name)) throw new Error('Invalid public event schedule');
  let timezone = text(event.timezone) || 'UTC';
  try { new Intl.DateTimeFormat('en', {timeZone: timezone}); } catch { timezone = 'UTC'; }
  const geo = record(event.geo_address_info);
  const online = ['online', 'virtual'].includes(text(event.location_type));
  const addressPublic = event.geo_address_visibility === 'public' && geo.mode !== 'obfuscated';
  return {id: text(event.api_id), title: text(event.name), url: `https://luma.com/${event.url}`,
    startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), timezone, allDay: false,
    city: online ? '' : text(geo.city) || text(geo.city_state), country: online ? '' : text(geo.country),
    location: !online && addressPublic ? text(geo.address) : '', online, locationHidden: !online && !addressPublic,
    status: event.cancelled_at ? 'cancelled' : 'scheduled', source, checkedAt};
}

function readPage(body: string, source: LumaSource, checkedAt: string): LumaImport {
  const match = body.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Public page metadata unavailable');
  const initial = record(record(record(JSON.parse(match[1]).props).pageProps).initialData);
  const data = record(initial.data);
  const result: LumaImport = {checkedAt, events: [], removed: [], hasMore: false};
  if (source.kind === 'event') {
    if (initial.kind !== 'event') throw new Error('Source is not an event');
    const raw = record(data.event);
    const event = eventFromPage(raw, text(record(data.calendar).name) || source.name, checkedAt);
    if (event) result.events.push(event);
    else result.removed.push({id: text(raw.api_id), url: `https://luma.com/${raw.url}`}, {id: text(raw.api_id), url: source.url});
  } else {
    if (!text(record(data.calendar).api_id)) throw new Error('Source is not a calendar');
    const upcoming = record(data.upcoming);
    if (!Array.isArray(upcoming.entries)) throw new Error('Calendar entries unavailable');
    result.hasMore = upcoming.has_more === true;
    for (const entry of upcoming.entries) {
      const raw = record(record(entry).event);
      const event = eventFromPage(raw, source.name, checkedAt);
      if (event) result.events.push(event);
      else result.removed.push({id: text(raw.api_id), url: `https://luma.com/${raw.url}`});
    }
  }
  return result;
}

const unescapeIcs = (value: string) => value.replace(/\\([nN,;\\])/g, (_, char: string) => char.toLowerCase() === 'n' ? '\n' : char);
function icsDate(value: string): string {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/);
  if (!match) throw new Error('Unsupported calendar date');
  const [, y, m, d, h = '00', min = '00', sec = '00'] = match;
  const iso = `${y}-${m}-${d}T${h}:${min}:${sec}.000Z`;
  if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString() !== iso) throw new Error('Invalid calendar date');
  return iso;
}

function readFeed(body: string, source: LumaSource, checkedAt: string): LumaImport {
  if (!body.trimStart().startsWith('BEGIN:VCALENDAR') || !body.includes('END:VCALENDAR')) throw new Error('Invalid public iCal feed');
  const result: LumaImport = {checkedAt, events: [], removed: [], hasMore: false};
  for (const block of body.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)) {
    if (!block.includes('END:VEVENT')) throw new Error('Incomplete iCal event');
    const fields: Record<string, string> = {};
    for (const line of block.split('END:VEVENT')[0].split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon > 0) fields[line.slice(0, colon).split(';')[0]] = line.slice(colon + 1);
    }
    if (fields.CLASS && fields.CLASS !== 'PUBLIC') {
      if (fields.UID) result.removed.push({id: fields.UID.split('@')[0], url: ''});
      continue;
    }
    const description = unescapeIcs(fields.DESCRIPTION || '');
    const link = `${fields.URL || ''}\n${description}`.match(/https:\/\/(?:luma\.com|lu\.ma)\/([\w-]+)/);
    if (!link || !fields.UID || !fields.SUMMARY) throw new Error('Invalid public iCal event');
    const startsAt = icsDate(fields.DTSTART || ''), endsAt = icsDate(fields.DTEND || '');
    if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Invalid iCal event duration');
    const address = description.includes('Address:\n') ? description.split('Address:\n')[1].split('\n\nHosted by')[0].split('\n') : [];
    const hasCity = address.length >= 3 && !address.slice(-2).some(line => /https?:\/\//i.test(line));
    // A feed LOCATION may contain a guest meeting link. Keep only plain public venue text.
    const venue = unescapeIcs(fields.LOCATION || '');
    const location = /https?:\/\/|\bwww\./i.test(venue) ? '' : venue;
    const online = /^(online|zoom|google meet)$/i.test(location);
    result.events.push({id: fields.UID.split('@')[0], title: unescapeIcs(fields.SUMMARY), url: `https://luma.com/${link[1]}`,
      startsAt, endsAt, timezone: 'UTC', allDay: fields.DTSTART.length === 8,
      city: !online && hasCity ? address.at(-2)!.split(',')[0].trim() : '', country: !online && hasCity ? address.at(-1)!.trim() : '',
      location: online ? '' : location, online, locationHidden: !online && !location,
      status: fields.STATUS === 'CANCELLED' ? 'cancelled' : 'scheduled', source: source.name, checkedAt});
  }
  return result;
}

export function parseLuma(body: string, source: LumaSource, checkedAt: string): LumaImport {
  return source.kind === 'feed' ? readFeed(body, source, checkedAt) : readPage(body, source, checkedAt);
}

/** Apply page metadata after feed metadata; absence from a partial feed is not cancellation. */
export function combineLuma(seed: CalendarEvent[], imports: {source: LumaSource; data: LumaImport}[], aliases: Record<string, string>, onlineEvents: string[], notes: Record<string, string>): CalendarEvent[] {
  const events = new Map(seed.map(event => [event.id, {...event}]));
  for (const {source, data} of imports) {
    for (const event of data.events) {
      const old = events.get(event.id) || [...events.values()].find(item => item.url === event.url);
      // Preserve original UID, timezone and richer venue metadata while accepting schedule/status changes.
      const timing = old && Date.parse(old.checkedAt) > Date.parse(event.checkedAt) ? old : event;
      const merged = {...(source.kind === 'feed' && old ? old : event), id: old?.id || event.id,
        title: timing.title, startsAt: timing.startsAt, endsAt: timing.endsAt, allDay: timing.allDay, status: timing.status, checkedAt: timing.checkedAt};
      events.set(merged.id, merged);
    }
  }
  // Privacy removals win over every source, including another calendar's stale feed.
  for (const {data} of imports) for (const removed of data.removed) {
    for (const [id, event] of events) if (id === removed.id || event.url === removed.url) events.delete(id);
  }
  const unique = new Map<string, CalendarEvent>();
  for (const event of events.values()) {
    if (aliases[event.url]) continue;
    if (onlineEvents.includes(event.url)) Object.assign(event, {online: true, locationHidden: false, location: '', city: '', country: ''});
    event.scheduleNote = notes[event.url] || '';
    unique.set(event.url, event);
  }
  return [...unique.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
