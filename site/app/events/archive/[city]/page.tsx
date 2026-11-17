import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {eventArchive,eventPhotos} from '../../../../lib/event-archive';
import {SiteHeader,SiteFooter} from '../../../community-ui';
import PhotoGallery from '../../../photo-gallery';
import EventFilms from '../../../event-films';

export function generateStaticParams(){return eventArchive.map(event=>({city:event.slug}));}
export async function generateMetadata({params}:{params:Promise<{city:string}>}):Promise<Metadata>{
  const {city}=await params;
  const selected=eventArchive.find(e=>e.slug===city);
  return selected?{title:`${selected.city}: ${selected.title} — Supanauts`,description:selected.description}:{title:'Event not found — Supanauts'};
}
export default async function ArchiveEventPage({params}:{params:Promise<{city:string}>}){
  const {city}=await params;
  const event=eventArchive.find(e=>e.slug===city);
  if(!event)notFound();
  const photos=eventPhotos(event.city);
  return <><SiteHeader/><main id="main" className="public-page archive-detail">
    <a href="/events#archive">← All meetups</a>
    <p className="eyebrow">{event.city} · {event.date}</p>
    <h1>{event.title}</h1><p className="lede">{event.description}</p>
    {event.venue&&<p className="archive-venue">{event.venue}</p>}
    <div className="prose">{event.paragraphs.map(p=><p key={p}>{p}</p>)}</div>
    {event.source&&<a className="outline" href={event.source} target="_blank" rel="noreferrer">Original event page ↗</a>}
    {photos.length>0&&<section className="event-gallery-section"><h2>{event.film==='dublin'?'From the event film.':'The people. The moments.'}</h2><PhotoGallery photos={photos} filters={false}/></section>}
    {event.film&&<EventFilms initialFilm={event.film}/>}
    {event.resources.length>0&&<section className="archive-resources"><h2>From the meetup</h2>{event.resources.map(resource=><a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.title} ↗</a>)}</section>}
    <section className="archive-participate"><h2>Keep building together.</h2><p>Were you there? Share what you built or tell us what you’re working on now.</p><div className="actions"><a className="primary" href="/projects/new">Share your project ↗</a><a href="/member?next=%2Fmember%2Fcommunity">Join the member conversation ↗</a></div></section>
    <p className="fineprint">Event media from the organizer’s archive. Film stills are labelled. <a href="/help/report">Request a correction or photo removal</a>.</p>
  </main><SiteFooter/></>;
}
