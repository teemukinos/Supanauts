/** Organizer-provided community information, confirmed 14 November 2026. */
// Only the month is confirmed. Do not generate a date, venue, registration or calendar entry.
export const nextMeetupAnnouncement = {month:'2026-12',label:'December 2026'};
export function hasMeetupAnnouncement(){return Date.now()<Date.parse('2027-01-01T00:00:00Z');}
