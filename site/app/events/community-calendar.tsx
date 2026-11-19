'use client';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarDays, CalendarPlus, Check, List, ChevronLeft, ChevronRight, ArrowUpRight, MapPin, Globe, Search, X, Copy, Download, AlertCircle} from 'lucide-react';
import {dateKey, occursOn, type CalendarEvent} from '../../lib/calendar';

const dateFormat = (date: string, options: Intl.DateTimeFormatOptions, zone = 'UTC') => new Intl.DateTimeFormat('en-GB', {timeZone: zone, ...options}).format(new Date(date));
const cityLabel = (event: CalendarEvent) => [...new Set([event.city, event.country].filter(Boolean))].join(', ') || event.location || 'Location on event page';

function MonthGrid({month, day, today, events, timezone, compact, onMonth, onDay}: {
  month: string; day: string; today: string; events: CalendarEvent[]; timezone: string; compact?: boolean;
  onMonth: (month: string) => void; onDay: (day: string) => void;
}) {
  const monthDate = new Date(`${month}-01T12:00:00Z`);
  const leading = (monthDate.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const slots = Math.ceil((leading + days) / 7) * 7;
  const [focusDate, setFocusDate] = useState('');
  const tabDate = focusDate.startsWith(month) ? focusDate : day.startsWith(month) ? day : today.startsWith(month) ? today : `${month}-01`;
  function move(change: number) { onMonth(new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + change, 1)).toISOString().slice(0, 7)); }
  return <div className={`calendar-month ${compact ? 'is-compact' : ''}`}>
    <div className="calendar-month-heading"><h2>{dateFormat(monthDate.toISOString(), {month: 'long', year: 'numeric'})}</h2><div><button className="calendar-icon-button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={17} aria-hidden="true"/></button><button className="calendar-icon-button" aria-label="Next month" onClick={() => move(1)}><ChevronRight size={17} aria-hidden="true"/></button></div></div>
    <div className="calendar-weekdays" aria-hidden="true">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <span key={i}>{compact ? label : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>)}</div>
    <div className="calendar-grid">{Array.from({length: slots}, (_, i) => {
      const date = i - leading + 1;
      if (date < 1 || date > days) return <div className="calendar-blank" aria-hidden="true" key={i}/>;
      const key = `${month}-${String(date).padStart(2, '0')}`;
      const entries = events.filter(event => occursOn(event, key, timezone));
      return <button key={i} className={entries.length ? 'has-events' : ''} aria-current={key === today ? 'date' : undefined} aria-pressed={day === key}
        aria-label={`${dateFormat(key + 'T12:00:00Z', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}, ${entries.length} ${entries.length === 1 ? 'event' : 'events'}`}
        tabIndex={key === tabDate ? 0 : -1} onFocus={() => setFocusDate(key)}
        onKeyDown={event => {
          const steps: Record<string, number> = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7};
          const step = steps[event.key];
          if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          const next = event.key === 'Home' ? 1 : event.key === 'End' ? days : Math.min(days, Math.max(1, date + step!));
          const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
          buttons?.[next - 1]?.focus();
        }}
        title={entries.map(event => event.title).join('\n') || undefined} onClick={() => onDay(day === key ? '' : key)}>
        <span className="calendar-day-number">{date}</span>{compact ? entries.length > 0 && <span className="calendar-day-mark" aria-hidden="true"/> : <span className="calendar-cell-events">{entries.slice(0, 2).map(event => <span key={event.id}>{event.title}</span>)}{entries.length > 2 && <small>+{entries.length - 2} more</small>}</span>}
        {!compact && entries.length > 0 && <span className="calendar-day-count">{entries.length}</span>}
      </button>;
    })}</div>
    <div className="calendar-month-foot"><button className="calendar-text-button" onClick={() => {onMonth(today.slice(0, 7)); onDay('');}}>This month</button><span>{compact ? 'Select a date to filter' : 'Select a date for event details'}</span></div>
  </div>;
}

function EventRow({event, timezone, now}: {event: CalendarEvent; timezone: string; now: string}) {
  const zone = event.allDay ? 'UTC' : timezone;
  const startDay = dateKey(event.startsAt, zone);
  const endDay = dateKey(event.endsAt, zone);
  const time = event.allDay ? 'All day' : `${dateFormat(event.startsAt, {hour: '2-digit', minute: '2-digit'}, zone)}–${startDay !== endDay ? dateFormat(event.endsAt, {day: 'numeric', month: 'short'}, zone) + ', ' : ''}${dateFormat(event.endsAt, {hour: '2-digit', minute: '2-digit'}, zone)}`;
  const ongoing = Date.parse(event.startsAt) <= Date.parse(now) && Date.parse(event.endsAt) > Date.parse(now);
  return <article className={`calendar-event ${event.status === 'cancelled' ? 'is-cancelled' : ''}`}>
    <time className="calendar-date" dateTime={event.startsAt}><strong>{dateFormat(event.startsAt, {day: '2-digit'}, zone)}</strong><span>{dateFormat(event.startsAt, {weekday: 'short'}, zone)}</span></time>
    <div className="calendar-event-body"><div className="calendar-event-meta"><time dateTime={event.startsAt}>{time}</time>{event.online && <span className="calendar-format"><Globe size={13} aria-hidden="true"/>Online</span>}{event.status === 'cancelled' ? <strong className="calendar-status">Cancelled</strong> : ongoing && <strong className="calendar-status">Happening now</strong>}</div>
      <h3><a href={event.url} target={event.url.startsWith('https:') ? '_blank' : undefined} rel="noreferrer">{event.title}<ArrowUpRight size={17} aria-hidden="true"/></a></h3>
      <p className="calendar-location">{event.online ? <Globe size={14} aria-hidden="true"/> : <MapPin size={14} aria-hidden="true"/>}{event.online ? 'Join online' : cityLabel(event)}</p>
      {event.locationHidden && !event.online && <p className="calendar-private-location">Address shared after registration</p>}
      {event.scheduleNote && <p className="calendar-notice"><AlertCircle size={16} aria-hidden="true"/><span>{event.scheduleNote}</span></p>}
      <div className="calendar-event-bottom"><p className="calendar-source">{event.source}{event.localPath && <a href={event.localPath}>Supanauts recap</a>}</p>{!event.scheduleNote && <a className="calendar-add" href={`/api/calendar?event=${encodeURIComponent(event.id)}`} aria-label={`Add ${event.title} to calendar`}><CalendarPlus size={16} aria-hidden="true"/><span>Add to calendar</span></a>}</div>
    </div>
  </article>;
}

export default function CommunityCalendar({events, now, updatedAt, sourceInfo}: {events: CalendarEvent[]; now: string; updatedAt: string; sourceInfo: ReactNode}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [format, setFormat] = useState('all');
  const [period, setPeriod] = useState('upcoming');
  const [view, setView] = useState('agenda');
  const [timezone, setTimezone] = useState('UTC');
  const [month, setMonth] = useState(now.slice(0, 7));
  const [day, setDay] = useState('');
  const [limit, setLimit] = useState(30);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  useEffect(() => { const zone = Intl.DateTimeFormat().resolvedOptions().timeZone; setTimezone(zone); setMonth(dateKey(new Date().toISOString(), zone).slice(0, 7)); setCalendarUrl(`${window.location.origin}/api/calendar`); }, []);
  useEffect(() => {
    let lastRefresh = Date.now();
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 5 * 60_000) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, 5 * 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [router]);
  const zones = useMemo(() => Array.from(new Set(['UTC', timezone, ...events.map(e => e.timezone)])).sort(), [events, timezone]);
  const cities = useMemo(() => [...new Set(events.filter(e => !e.online).map(e => e.city).filter(Boolean))].sort(), [events]);
  const matching = useMemo(() => events.filter(event => {
    const upcoming = Date.parse(event.endsAt) > Date.parse(now);
    return (period === 'all' || (period === 'upcoming' ? upcoming : !upcoming)) && (!city || event.city === city) &&
      (format === 'all' || (format === 'online' ? event.online : !event.online)) &&
      `${event.title} ${event.city} ${event.country} ${event.location} ${event.source}`.toLowerCase().includes(query.toLowerCase().trim());
  }).sort((a, b) => period === 'past' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)), [events, now, period, city, format, query]);
  const monthStart = `${month}-01`;
  const monthDate = new Date(`${monthStart}T12:00:00Z`);
  const nextMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const inMonth = matching.filter(e => dateKey(e.startsAt, e.allDay ? 'UTC' : timezone) < nextMonth && dateKey(new Date(Date.parse(e.endsAt) - 1).toISOString(), e.allDay ? 'UTC' : timezone) >= monthStart);
  const visible = day ? matching.filter(e => occursOn(e, day, timezone)) : view === 'month' ? inMonth : matching;
  const upcomingCount = events.filter(e => Date.parse(e.endsAt) > Date.parse(now)).length;
  const today = dateKey(now, timezone);
  const activeFilters = Boolean(query || city || format !== 'all' || day);
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of visible.slice(0, limit)) {
    const key = dateKey(event.startsAt, event.allDay ? 'UTC' : timezone).slice(0, 7);
    groups.set(key, [...(groups.get(key) || []), event]);
  }
  function resetPage() { setLimit(30); setDay(''); }
  function clearFilters() { setQuery(''); setCity(''); setFormat('all'); resetPage(); }
  function changeMonth(value: string) { setMonth(value); resetPage(); }
  function changeDay(value: string) { setDay(value); setLimit(30); }
  async function copySubscription() {
    try { await navigator.clipboard.writeText(calendarUrl); setCopied(true); setMessage('Link copied. In your calendar app, choose “Subscribe” or “Add calendar from URL”, then paste this link.'); }
    catch { setCopied(false); setMessage('Select and copy the URL below. In your calendar app, add a calendar subscription using this URL.'); }
  }
  const monthProps = {month, day, today, events: inMonth, timezone, onMonth: changeMonth, onDay: changeDay};
  return <div className="community-calendar">
    <div className="calendar-actions"><div className="calendar-period" role="group" aria-label="Event dates">{[['upcoming', 'Upcoming'], ['past', 'Past events'], ['all', 'All events']].map(([value, label]) => <button key={value} aria-pressed={period === value} onClick={() => {setPeriod(value); resetPage();}}>{label}{value === 'upcoming' && <span>{upcomingCount}</span>}</button>)}</div><button className="calendar-subscribe" disabled={!calendarUrl} onClick={copySubscription}>{copied ? <Check size={17} aria-hidden="true"/> : <CalendarPlus size={17} aria-hidden="true"/>}Subscribe to calendar</button></div>
    {message && <div className="calendar-subscription-panel"><div><p role="status">{message}</p><label htmlFor="subscription-url">Calendar subscription URL</label><div className="calendar-url"><input id="subscription-url" value={calendarUrl} readOnly onFocus={event => event.target.select()}/><button className="calendar-icon-button" aria-label="Copy subscription URL" onClick={copySubscription}><Copy size={17}/></button></div><p>Subscriptions reflect source refreshes. For a one-time import, <a href="/api/calendar" download="supanauts.ics">download the .ics file</a>.</p></div><button className="calendar-icon-button" aria-label="Dismiss subscription instructions" onClick={() => setMessage('')}><X size={18}/></button></div>}
    <div className="calendar-workspace"><div className="calendar-main">
      <div className="calendar-filters"><label className="calendar-search"><span className="calendar-sr-only">Search events</span><Search size={18} aria-hidden="true"/><input type="search" placeholder="Search events, cities or organizers" value={query} onChange={e => {setQuery(e.target.value); resetPage();}}/></label><label className="calendar-select"><span className="calendar-sr-only">City</span><MapPin size={16} aria-hidden="true"/><select aria-label="City" value={city} onChange={e => {setCity(e.target.value); resetPage();}}><option value="">All cities</option>{cities.map(value => <option key={value}>{value}</option>)}</select></label><label className="calendar-select"><span className="calendar-sr-only">Format</span><select aria-label="Format" value={format} onChange={e => {setFormat(e.target.value); resetPage();}}><option value="all">All formats</option><option value="in-person">In person</option><option value="online">Online</option></select></label></div>
      <div className="calendar-display"><p aria-live="polite">{visible.length} {visible.length === 1 ? 'event' : 'events'}{day ? ` on ${dateFormat(day + 'T12:00:00Z', {day: 'numeric', month: 'short'})}` : period === 'upcoming' ? ' coming up' : ''}</p><div className="calendar-view" role="group" aria-label="Calendar view"><button aria-pressed={view === 'agenda'} onClick={() => {setView('agenda'); resetPage();}}><List size={16} aria-hidden="true"/>Agenda</button><button aria-pressed={view === 'month'} onClick={() => {setView('month'); resetPage();}}><CalendarDays size={16} aria-hidden="true"/>Month</button></div></div>
      <div className="calendar-zone-row"><label className="calendar-zone"><Globe size={14} aria-hidden="true"/><span>Times in</span><select aria-label="Display timezone" value={timezone} onChange={e => {setTimezone(e.target.value); setDay('');}}>{zones.map(zone => <option key={zone}>{zone}</option>)}</select></label>{activeFilters && <button className="calendar-text-button" onClick={clearFilters}><X size={13} aria-hidden="true"/>Clear filters</button>}</div>
      {Date.parse(now) - Date.parse(updatedAt) > 7 * 86400000 && <p className="calendar-notice" role="status"><AlertCircle size={16}/><span>Sources have not refreshed for more than a week. Confirm details with the organizer.</span></p>}
      {view === 'month' && <MonthGrid {...monthProps}/>}
      <div className="calendar-results">{visible.length === 0 ? <div className="calendar-empty"><CalendarDays size={28} aria-hidden="true"/><h2>No events here yet.</h2><p>{day ? 'There are no matching events on this date. Choose another day or clear your filters.' : view === 'month' ? 'Try another month or return to the agenda to see all matching events.' : 'Try another city, format or search. New events appear after the next source refresh.'}</p><div>{activeFilters && <button className="calendar-secondary" onClick={clearFilters}>Clear filters</button>}{view === 'month' && <button className="calendar-secondary" onClick={() => {setView('agenda'); resetPage();}}>Back to agenda</button>}{period === 'upcoming' && <button className="calendar-text-button" onClick={() => {setPeriod('past'); resetPage();}}>Browse past events</button>}</div></div> : [...groups].map(([group, items]) => <section className="calendar-event-group" key={group} aria-label={dateFormat(`${group}-01T12:00:00Z`, {month: 'long', year: 'numeric'})}><h2>{dateFormat(`${group}-01T12:00:00Z`, {month: 'long', year: 'numeric'})}<span>{items.length}</span></h2>{items.map(event => <EventRow key={event.id} event={event} timezone={timezone} now={now}/>)}</section>)}</div>
      {visible.length > limit && <button className="calendar-secondary calendar-more" onClick={() => setLimit(limit + 30)}>Show more events<span>{visible.length - limit} remaining</span></button>}
      <p className="calendar-checked">Last source check {dateFormat(updatedAt, {dateStyle: 'medium', timeStyle: 'short'}, timezone)} ({timezone}). Confirm details with the organizer.</p>
    </div><aside className="calendar-sidebar" aria-label="Calendar tools">
      {view === 'agenda' && <div className="calendar-mini"><MonthGrid {...monthProps} compact/>{day && <button className="calendar-text-button" onClick={() => setDay('')}>Show all dates</button>}</div>}
      <div className="calendar-suggest"><h2>Make room for your community.</h2><p>Know a Supabase event we’ve missed? Send us the public Luma link.</p><a className="calendar-secondary" href="mailto:teemu@skene.ai?subject=Supanauts%20calendar%20event&body=Luma%20event%20URL%3A%20">Suggest an event <ArrowUpRight size={16} aria-hidden="true"/></a></div>
      {sourceInfo}
      <a className="calendar-download" href="/api/calendar" download="supanauts.ics"><Download size={15} aria-hidden="true"/>Download calendar (.ics)</a>
    </aside></div>
  </div>;
}
