'use client';

import {useRef,useState,type ReactNode} from 'react';
import type {SupaSquadPerson} from '../../lib/supasquad';
import SupaSquadGlobe from './globe';

function normalized(value:string){return value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();}

export default function SupaSquadDirectory({people,intro}:{people:SupaSquadPerson[];intro:ReactNode}){
  const [query,setQuery]=useState('');
  const [kind,setKind]=useState('all');
  const search=useRef<HTMLInputElement>(null);
  const terms=normalized(query).trim().split(/\s+/).filter(Boolean);
  const matches=people.filter(person=>{
    const searchable=normalized([person.name,person.location,person.summary,...person.topics].join(' '));
    return (kind==='all'||person.kind===kind)&&terms.every(term=>searchable.includes(term));
  });
  function reset(){setQuery('');setKind('all');}

  return <><div className="supasquad-hero"><div className="supasquad-intro">{intro}</div>
    <SupaSquadGlobe people={people} onChoose={person=>{setQuery(person.name);setKind('all');search.current?.focus();}}/>
  </div><section aria-label="SupaSquad people directory">
    <div className="supasquad-search">
      <div><label htmlFor="people-search">Name, place or topic</label>
        <input ref={search} id="people-search" type="search" placeholder="Try Helsinki, Flutter or a name" value={query} onChange={event=>setQuery(event.target.value)} aria-controls="people-results"/>
      </div>
      <div><label htmlFor="people-kind">Show</label>
        <select id="people-kind" value={kind} onChange={event=>setKind(event.target.value)} aria-controls="people-results">
          <option value="all">All public profiles</option>
          <option value="membership">Membership statements</option>
          <option value="contributor">Programme contributors</option>
        </select>
      </div>
      <button className="outline" type="button" onClick={reset} disabled={!query&&kind==='all'}>Clear filters</button>
    </div>
    <p className="fineprint" role="status" aria-live="polite">{matches.length} of {people.length} public profiles</p>
    <div id="people-results">
      {matches.length?<ul className="supasquad-people">
        {matches.map(person=><li key={person.profileUrl}>
          <article className="supasquad-person">
            <span className="supasquad-kind">{person.kind==='membership'?'Membership statement':'Programme contributor'}</span>
            <h2>{person.name}</h2>
            {person.location&&<p className="supasquad-place">{person.location}</p>}
            <p>{person.summary}</p>
            <ul className="supasquad-topics" aria-label="Topics">{person.topics.map(topic=><li key={topic}>{topic}</li>)}</ul>
            <div className="supasquad-person-links">
              <a href={person.profileUrl} aria-label={`Public profile: ${person.name}`}>Public profile ↗</a>
              <a href={person.sourceUrl} className="fineprint" aria-label={`Source for ${person.name}: ${person.sourceLabel}`}>{person.sourceLabel} ↗</a>
            </div>
          </article>
        </li>)}
      </ul>:<div className="compact-empty"><h2>No matching people</h2><p>Try another name, place or topic, or clear the filters to see everyone listed.</p><button className="primary" onClick={reset}>Show all profiles</button></div>}
    </div>
  </section></>;
}
