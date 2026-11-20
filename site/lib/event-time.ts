// Store instants in UTC while editing the wall-clock time in the event's timezone.
export function localEventTime(value: string | undefined, timezone: string) {
  if (!value) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const part = (key: string) => parts.find((p) => p.type === key)?.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  } catch {
    return '';
  }
}

export function eventTimeUTC(value: string, timezone: string) {
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  if (!value) return '';
  const wall = Date.parse(value + 'Z');
  if (!Number.isFinite(wall)) throw Error('Enter a valid event date and time.');
  // Collect the offsets on both sides of any daylight-saving transition.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = wall + hours * 3600000;
    offsets.add(Date.parse(localEventTime(new Date(instant).toISOString(), timezone) + 'Z') - instant);
  }
  const matches = [...offsets]
    .map((offset) => new Date(wall - offset).toISOString())
    .filter((instant) => localEventTime(instant, timezone) === value);
  if (matches.length === 0)
    throw Error('This local time does not exist because the clocks change. Choose another time.');
  if (matches.length > 1)
    throw Error(
      'This local time occurs twice because the clocks change. Choose another time, or enter the exact time in UTC.',
    );
  return matches[0];
}
