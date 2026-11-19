import type {ContentItem} from './participation';
import sources from '../data/luma-sources.json';

export type CalendarEvent = {
  id: string; title: string; url: string; startsAt: string; endsAt: string;
  timezone: string; allDay: boolean; city: string; country: string; location: string;
  online: boolean; locationHidden: boolean; status: string; source: string; checkedAt: string;
  localPath?: string; scheduleNote?: string;
};

export function lumaUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['luma.com', 'lu.ma', 'www.luma.com'].includes(url.hostname)) return value;
    const canonical = 'https://luma.com' + url.pathname.replace(/\/$/, '');
    return (sources.aliases as Record<string, string>)[canonical] || canonical;
  } catch { return value; }
}

export function mergeEvents(imported: CalendarEvent[], published: ContentItem[]): CalendarEvent[] {
  const events = new Map(imported.map(event => [lumaUrl(event.url), {...event}]));
  for (const item of published) {
    const data = item.data;
    if (item.kind !== 'event') continue;
    const key = lumaUrl(data.registration_url || `/events/${item.slug}`);
    const match = events.get(key);
    if (match) {
      // Retain the verified source time and stable UID when enriching an imported listing.
      events.set(key, {...match, localPath: `/events/${item.slug}`, status: data.cancelled ? 'cancelled' : match.status});
      continue;
    }
    if (!data.starts_at || !data.ends_at || !Number.isFinite(Date.parse(data.starts_at)) || !Number.isFinite(Date.parse(data.ends_at)) || Date.parse(data.ends_at) <= Date.parse(data.starts_at)) continue;
    let timezone = data.timezone || 'UTC';
    try { new Intl.DateTimeFormat('en', {timeZone: timezone}); } catch { timezone = 'UTC'; }
    events.set(key, {id: item.id, title: data.title, url: data.registration_url || `/events/${item.slug}`,
      startsAt: data.starts_at, endsAt: data.ends_at, timezone, allDay: false,
      city: data.city || '', country: '', location: data.venue || '', online: false,
      locationHidden: !data.venue, status: data.cancelled ? 'cancelled' : 'scheduled',
      source: 'Supanauts', checkedAt: item.published_at, localPath: `/events/${item.slug}`});
  }
  return [...events.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function dateKey(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

export function occursOn(event: CalendarEvent, date: string, timezone: string): boolean {
  const zone = event.allDay ? 'UTC' : timezone;
  return dateKey(event.startsAt, zone) <= date && dateKey(new Date(Date.parse(event.endsAt) - 1).toISOString(), zone) >= date;
}
