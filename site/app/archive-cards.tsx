import {eventArchive,eventPhotos} from '../lib/event-archive';
import EventPhoto from './event-photo';

export function ArchiveCards({city='All cities'}:{city?:string}){
  return <div className="card-grid archive-cards">{eventArchive.filter(e=>city==='All cities'||e.city===city).map(event=>{
    const photo=eventPhotos(event.city)[0];
    return <article className="content-card" key={event.slug}><a href={'/events/archive/'+event.slug}>
      {photo?<EventPhoto className={photo.kind==='film-still'?'film-still-cover':undefined} file={photo.file} alt={photo.alt} width={photo.width} height={photo.height} thumbnail/>:<div className="archive-city-art" aria-hidden="true"><span>{event.city}</span><small>{event.date}</small></div>}
      <div className="card-copy"><p className="eyebrow">{event.city} · {event.date}</p><h3>{event.title}</h3><p>{event.description}</p><span className="archive-card-link">{photo?'Photos & event details':'Event details'} ↗</span></div>
    </a></article>;
  })}</div>;
}

export function PhotoHighlights(){
  return <section className="section photo-highlights" aria-labelledby="photos-heading">
    <div className="section-heading"><div><p className="eyebrow">FROM THE COMMUNITY</p><h2 id="photos-heading">Off the screen.<br/><span>In good company.</span></h2></div><a href="/community/photos">All photos ↗</a></div>
    <div className="photo-highlights-grid">{['Helsinki','Stockholm','Berlin','Amsterdam'].flatMap(city=>eventPhotos(city).slice(0,1)).map(photo=><a key={photo.file} href={'/events/archive/'+photo.city.toLowerCase()}><EventPhoto className={photo.kind==='film-still'?'film-still-cover':undefined} file={photo.file} alt={photo.alt} width={photo.width} height={photo.height} thumbnail/><span>{photo.city} · Explore the meetup ↗</span></a>)}</div>
  </section>;
}

export function ArchiveReading(){
  return <section className="archive-reading"><p className="eyebrow">KEEP EXPLORING</p><h2>Talks & meetup materials.</h2><p>Presentations from the organizer and the stories behind the meetups.</p><div className="card-grid">
    <article className="channel-card"><h3>Community on tour</h3><p>Teemu’s web presentation, with the roadshow films and community context.</p><a href="https://skene.ai/roadshow" target="_blank" rel="noreferrer">Open presentation ↗</a></article>
    <article className="channel-card"><h3>Dublin presentation</h3><p>Explore the web deck from the Dublin community archive.</p><a href="https://skene.ai/dublin" target="_blank" rel="noreferrer">Open presentation ↗</a></article>
    <article className="channel-card"><h3>Five cities. Shared ideas.</h3><p>Helsinki, Dublin, Stockholm, Berlin and Amsterdam: browse the event details and photographs.</p><a href="/events#archive">Explore the archive ↗</a></article>
  </div></section>;
}
