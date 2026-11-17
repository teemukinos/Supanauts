import type {Metadata} from 'next';
import {SiteHeader,SiteFooter} from '../../community-ui';
import PhotoGallery from '../../photo-gallery';
import {archivePhotos} from '../../../lib/event-archive';

export const metadata:Metadata={title:'Meetup photos — Supanauts',description:'Photographs from Helsinki, Stockholm, Berlin and Amsterdam, plus stills from the Dublin event film.'};
export default function Photos(){return <><SiteHeader/><main id="main" className="public-page">
  <p className="eyebrow">THE MEETUP ARCHIVE</p><h1>Good people.<br/>Shared ideas.</h1>
  <p className="lede">Conversations, demos and the people behind the projects. Helsinki, Stockholm, Berlin and Amsterdam in photographs; Dublin through its event film.</p>
  <PhotoGallery photos={archivePhotos}/>
  <div className="actions"><a className="primary" href="/events#archive">Explore the meetups ↗</a><a href="/projects/new">Share what you built ↗</a></div>
  <p className="fineprint">Photos from the organizer’s archive, used with permission. Film stills are labelled. <a href="/help/report">Request a photo removal</a>.</p>
  </main><SiteFooter/></>;}
