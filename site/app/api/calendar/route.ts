import {absolute, publicCommunity, siteOrigin} from '../../../lib/participation';
import {mergeEvents} from '../../../lib/calendar';
import {calendarIcs} from '../../../lib/calendar-ics';
import {lumaCalendar} from '../../../lib/luma-sync';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const [community, calendar] = await Promise.all([publicCommunity(), lumaCalendar()]);
  const requested = new URL(request.url).searchParams.get('event');
  const events = mergeEvents(calendar.events, community.content).filter(event => !requested || event.id === requested || event.localPath === `/events/${requested}`);
  if (requested && events.some(event => event.scheduleNote)) return new Response('Confirm this event date with the organizer before adding it to a calendar.', {status: 409});
  if (requested && !events.length) return new Response('Event not found', {status: community.unavailable && !community.preview ? 503 : 404});
  // An empty source cache during an outage can omit events seen by subscribers.
  // Let clients keep their last feed instead of treating the fallback as deletion.
  if (!requested && calendar.incomplete) return new Response('Calendar source refresh temporarily unavailable', {status: 503, headers: {'Retry-After': '300', 'X-Calendar-Sync': 'delayed'}});
  // A partial subscription can remove missing events from calendar clients. Fail closed
  // when published Supanauts content is temporarily unavailable in a configured backend.
  if (!requested && community.unavailable && !community.preview) return new Response('Calendar temporarily unavailable', {status: 503, headers: {'Retry-After': '300'}});
  return new Response(calendarIcs(events.map(event => ({...event, url: event.url.startsWith('/') ? absolute(event.url) : event.url})), siteOrigin()), {headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'attachment; filename="supanauts.ics"',
    'Cache-Control': 'no-store',
    'X-Calendar-Source-Checked': calendar.updatedAt,
    'X-Calendar-Sync': !calendar.enabled ? 'paused' : calendar.delayed ? 'delayed' : 'active',
  }});
}
