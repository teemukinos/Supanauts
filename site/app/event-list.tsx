'use client';
import {useState} from 'react';
import {hasMeetupAnnouncement,nextMeetupAnnouncement} from '../lib/community-content';
import {eventArchive} from '../lib/event-archive';
import type {ContentItem} from '../lib/participation';
import {ItemCard} from './community-ui';
import {ArchiveCards} from './archive-cards';

export function EventList({items}:{items:ContentItem[]}){
  const [city,setCity]=useState('All cities');
  const cities=Array.from(new Set([...eventArchive.map(x=>x.city),...items.map(x=>x.data.city).filter((x):x is string=>!!x)]));
  const selected=items.filter(x=>city==='All cities'||x.data.city===city).sort((a,b)=>(b.data.starts_at||'').localeCompare(a.data.starts_at||''));
  const hasUpcoming=items.some(x=>x.data.starts_at&&Date.parse(x.data.starts_at)>=Date.now());
  return <>
    {!hasUpcoming&&hasMeetupAnnouncement()&&<section className="channel-card"><p className="eyebrow">NEXT MEETUP</p><h2>{nextMeetupAnnouncement.label}</h2><p>Location, exact date and registration will be shared with members once confirmed.</p><a href="/member?next=%2Fmember%2Fcommunity">Sign in for meetup details ↗</a></section>}
    <label className="city-select">City<select value={city} onChange={e=>setCity(e.target.value)}><option>All cities</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
    {selected.length>0&&<div className="card-grid">{selected.map(x=><ItemCard key={x.id} item={x} kind="event"/>)}</div>}
    <section id="archive"><h2>From the meetups.</h2><p>Explore the photos, programmes and materials from five cities.</p><ArchiveCards city={city}/>{!eventArchive.some(e=>city==='All cities'||e.city===city)&&<p>No archived meetup for this city yet.</p>}</section>
  </>;
}
