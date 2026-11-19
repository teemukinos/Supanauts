import type {Metadata} from 'next';
import {ArrowUpRight} from 'lucide-react';
import {publicCommunity} from '../../lib/participation';
import {mergeEvents} from '../../lib/calendar';
import {eventArchive, eventPhotos} from '../../lib/event-archive';
import {lumaCalendar} from '../../lib/luma-sync';
import {SiteFooter, SiteHeader} from '../community-ui';
import EventPhoto from '../event-photo';
import CommunityCalendar from './community-calendar';
import './calendar.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Community calendar — Supanauts', description: 'Find Supabase meetups, workshops and community events around the world. Browse public Luma listings in one calendar.'};

export default async function Page() {
  const [community, calendar] = await Promise.all([publicCommunity(), lumaCalendar()]);
  const events = mergeEvents(calendar.events, community.content);
  const sourceInfo = <div className="calendar-about" id="calendar-sources">
    <h2>A wider circle.</h2>
    <p>{events.length} public listings, brought together from Luma and the Supanauts community.</p>
    <a className="calendar-source-link" href="https://luma.com/supabase_community_events" target="_blank" rel="noreferrer">Supabase events on Luma <ArrowUpRight size={16} aria-hidden="true"/></a>
    <details className="calendar-coverage"><summary>Sources & coverage</summary>
      <p>We combine the Supabase Community Events calendar, public Luma listings found through search, and published Supanauts events. Partner events may have limited audiences or require approval.</p>
      <p>{calendar.enabled ? 'Sources refresh automatically about once an hour while the calendar or subscription is being used. Open calendar pages check for updates every five minutes.' : 'Automatic source refresh is paused. Previously checked listings remain available.'} We discover events from the Supabase calendar and recheck upcoming and recent listings. Independent events outside the configured sources may be missing; this is not a complete index of Luma. Private and unlisted events are excluded when verified. Confirm times and registration on the original listing.</p>
      {calendar.delayed > 0 && <p>{calendar.delayed} source checks are delayed or unavailable. Last checked listings remain available while we retry.</p>}
      {calendar.limited && <p>Some source pages contain more events than one refresh can check. Additional event checks rotate across refreshes.</p>}
    </details>
  </div>;
  return <><SiteHeader activePath="/events"/><main id="main" className="public-page calendar-page">
    <div className="calendar-intro"><h1>Community calendar<span aria-hidden="true">.</span></h1><p>Find Supabase meetups, workshops and build days around the world.</p></div>
    {community.unavailable && !community.preview && <p role="status" className="calendar-notice">Supanauts submissions are temporarily unavailable. Public Luma listings remain available.</p>}
    {calendar.delayed > 0 && <p role="status" className="calendar-notice">Some Luma sources are awaiting refresh. Showing the last available listings.</p>}
    <CommunityCalendar events={events} now={new Date().toISOString()} updatedAt={calendar.updatedAt} sourceInfo={sourceInfo}/>
    <section id="archive" className="calendar-archive"><div className="calendar-archive-heading"><div><h2>After the meetup.</h2><p>Photos, programmes and materials from our five-city community tour.</p></div><a href="/community/photos">All community photos <ArrowUpRight size={18} aria-hidden="true"/></a></div>
      <div className="calendar-archive-grid">{eventArchive.map(event => {
        const photo = eventPhotos(event.city)[0];
        return <article key={event.slug}><a href={`/events/archive/${event.slug}`}>
          {photo && <div className={`calendar-archive-photo ${photo.kind === 'film-still' ? 'is-film' : ''}`}><EventPhoto file={photo.file} alt={photo.alt} width={photo.width} height={photo.height} thumbnail/></div>}
          <div className="calendar-archive-copy"><h3>{event.city}<ArrowUpRight size={16} aria-hidden="true"/></h3><p>{event.date}</p><span>{event.title}</span></div>
        </a></article>;
      })}</div>
    </section>
  </main><SiteFooter/></>;
}
