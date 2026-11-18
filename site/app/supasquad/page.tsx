import type {Metadata} from 'next';
import {SiteFooter,SiteHeader} from '../community-ui';
import SupaSquadDirectory from './people';
import {supaSquadCheckedOn,supaSquadPeople} from '../../lib/supasquad';

export const metadata:Metadata={
  title:'Find SupaSquad people — Supanauts',
  description:'Find publicly documented SupaSquad members and programme contributors by name, location or topic. Explore their work and public profiles.',
};

export default function SupaSquadPage(){return <>
  <SiteHeader activePath="/supasquad"/>
  <main id="main" className="public-page supasquad-page">
    <SupaSquadDirectory people={supaSquadPeople} intro={<><p className="eyebrow">THE PEOPLE BEHIND THE COMMUNITY</p>
    <h1>Find SupaSquad people.</h1>
    <p className="lede">Find a local host, explore someone’s work or meet another contributor. Search public profiles by name, place or topic.</p>
    <p className="fineprint">An independent directory of public membership statements and programme contributors, not an official or complete roster. Sources checked <time dateTime={supaSquadCheckedOn}>17 November 2026</time>.</p></>}/>
    <section className="supasquad-about" aria-labelledby="directory-about">
      <h2 id="directory-about">About this directory</h2>
      <p>“Membership statement” means the person publicly identifies as part of SupaSquad. “Programme contributor” means their work appears in SupaSquad’s public contribution records; it does not confirm current membership. Each profile links to its source.</p>
      <div className="actions">
        <a href="https://supabase.com/open-source/contributing/supasquad">Official SupaSquad programme ↗</a>
        <a href="mailto:teemu@skene.ai?subject=SupaSquad%20directory%20addition%20or%20correction">Suggest a person or correction ↗</a>
      </div>
      <p className="fineprint">For additions, include a public profile and a source confirming the person’s SupaSquad connection. To update or remove your listing, contact Teemu.</p>
    </section>
  </main>
  <SiteFooter/>
</>;}
