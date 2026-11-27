import CartoonWorld from './cartoon-world';
import EventFilms from './event-films';
import { PhotoHighlights } from './archive-cards';
import { hasMeetupAnnouncement, nextMeetupAnnouncement } from '../lib/community-content';
import {
  RewardAvailability,
  DateLabel,
  ItemCard,
  MotionControl,
  SiteFooter,
  SiteHeader,
  WhatsAppLinks,
} from './community-ui';
import { publicCommunity } from '../lib/participation';
export const dynamic = 'force-dynamic';

export default async function Home() {
  const data = await publicCommunity();
  const next = data.content
    .filter((x) => x.kind === 'event' && x.data.starts_at && Date.parse(x.data.starts_at) >= Date.now())
    .sort((a, b) => Date.parse(a.data.starts_at!) - Date.parse(b.data.starts_at!))[0];
  return (
    <>
      <SiteHeader />
      <main id="main" className="home-compact">
        <MotionControl />
        <section className="hero">
          <div className="hero-body">
            <div className="headline">
              <p className="eyebrow">AN UNOFFICIAL SUPABASE COMMUNITY</p>
              <h1>
                BUILD WITH
                <br />
                <em>SUPABASE.</em>
              </h1>
              <p className="intro">
                Supanauts is an independent community for Supabase developers. Join local meetups, share your
                projects, and keep learning from each other after the event.
              </p>
              <div className="hero-actions">
                <a className="primary" href="/join">
                  Join the community ↗
                </a>
                <a href="https://github.com/teemukinos/Supanauts">View source on GitHub</a>
              </div>
              <div className="hero-next">
                {next ? (
                  <a href={'/events/' + next.slug}>
                    Next meetup · <DateLabel value={next.data.starts_at} timezone={next.data.timezone} /> ↗
                  </a>
                ) : hasMeetupAnnouncement() ? (
                  <a href="/events">
                    Next meetup ·{' '}
                    <time dateTime={nextMeetupAnnouncement.month}>{nextMeetupAnnouncement.label}</time> ↗
                  </a>
                ) : (
                  <a href="/events">Explore meetups ↗</a>
                )}
              </div>
            </div>
            <CartoonWorld />
          </div>
        </section>
        <section className="bd-home">
          <div>
            <p className="bd-label">DECEMBER 10 / 14 CITIES / 90 MINUTES</p>
            <h2>THE WORLD IS<br /><em>BUILDING.</em></h2>
            <p>See which city is leading and find your local Builder Day.</p>
          </div>
          <a className="bd-button" href="/builderday">Explore Builder Day <span aria-hidden="true">↗</span></a>
        </section>
        <EventFilms />
        <PhotoHighlights />
        <section className="section project-invitation" id="projects">
          <div>
            <h2>Built something with Supabase?</h2>
            {!data.projects.length && <p>Share your demo, what you learned, or where you’re stuck.</p>}
          </div>
          {data.projects.length > 0 && (
            <div className="card-grid">
              {data.projects.slice(0, 3).map((x) => (
                <ItemCard key={x.id} item={x} kind="project" />
              ))}
            </div>
          )}
          <a className="primary" href="/projects/new">
            Share your project ↗
          </a>
        </section>
        <section className="section stay-connected" id="whatsapp">
          <div>
            <h2>Between meetups.</h2>
            <a className="host-link" href="https://supabase.com/open-source/contributing/supasquad">
              Host a meetup ↗
            </a>
          </div>
          <WhatsAppLinks compact />
        </section>
        <section className="reward-strip" aria-label="Community rewards">
          <div className="reward-intro">
            <h2>Credits. Swag. A little extra.</h2>
            <p>
              From time to time, we share Supabase credits, T-shirts and swag with eligible community members.
            </p>
          </div>
          <RewardAvailability initial={data} compact />
          <a href="/member">Your rewards ↗</a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
