import type {CalendarEvent} from './calendar';

const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
function fold(line: string): string {
  const output: string[] = [];
  let current = '';
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > 75) { output.push(current); current = ' ' + char; }
    else current += char;
  }
  return [...output, current].join('\r\n');
}

export function calendarIcs(events: CalendarEvent[], origin: string): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Supanauts//Community calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Supanauts community calendar', 'X-WR-CALDESC:Public Supabase events. Check the original listing before attending.', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H'];
  for (const event of events) {
    if (event.scheduleNote) continue; // Conflicting published dates need organizer confirmation.
    const url = new URL(event.url, origin).toString();
    lines.push('BEGIN:VEVENT', `UID:${event.id}@supanauts.com`, `DTSTAMP:${stamp(event.checkedAt)}`, `LAST-MODIFIED:${stamp(event.checkedAt)}`,
      event.allDay ? `DTSTART;VALUE=DATE:${stamp(event.startsAt).slice(0, 8)}` : `DTSTART:${stamp(event.startsAt)}`,
      event.allDay ? `DTEND;VALUE=DATE:${stamp(event.endsAt).slice(0, 8)}` : `DTEND:${stamp(event.endsAt)}`,
      `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(`Source: ${event.source}\n${url}\nCheck the original listing for registration and changes.`)}`,
      `LOCATION:${escapeText(event.online ? 'Online — see event listing' : [event.location, event.city, event.country].filter(Boolean).join(', '))}`,
      `URL:${url}`, `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
