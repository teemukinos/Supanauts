'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import type {SupaSquadPerson} from '../../lib/supasquad';
import {supaSquadLocations} from '../../lib/supasquad-locations';
import {createGlobe} from './globe-renderer';

export default function SupaSquadGlobe({people,onChoose}:{people:SupaSquadPerson[];onChoose:(person:SupaSquadPerson)=>void}){
  const mapped=useMemo(()=>people.filter(person=>Boolean(supaSquadLocations[person.location])),[people]);
  const [selected,setSelected]=useState(()=>Math.max(0,mapped.findIndex(person=>person.name==='Teemu Kinos')));
  const [paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null);
  const engine=useRef<ReturnType<typeof createGlobe>>(null);
  const person=mapped[selected];

  useEffect(()=>{
    if(!canvas.current||!mapped.length)return;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    function motion(){setReduced(media.matches);}
    motion();media.addEventListener('change',motion);
    engine.current=createGlobe(canvas.current,mapped.map(p=>({...supaSquadLocations[p.location],label:p.location.split(',')[0]})),index=>{engine.current?.focus(index);setSelected(index);setPaused(true);});
    engine.current?.focus(Math.max(0,mapped.findIndex(p=>p.name==='Teemu Kinos')));
    engine.current?.setRunning(!media.matches);
    return ()=>{media.removeEventListener('change',motion);engine.current?.destroy();engine.current=null;};
  },[mapped]);
  useEffect(()=>{engine.current?.focus(selected);},[selected]);
  useEffect(()=>{engine.current?.setRunning(!paused&&!reduced);},[paused,reduced]);

  if(!person)return null;
  const location=supaSquadLocations[person.location];
  return <figure className="supasquad-globe" aria-labelledby="globe-caption">
    <div className="globe-toolbar"><span className="mono">{mapped.length} PUBLIC LOCATIONS</span>
      <button type="button" onClick={()=>setPaused(!paused)} disabled={reduced} aria-pressed={paused||reduced}>{reduced?'Reduced motion':paused?'Resume rotation':'Pause rotation'}</button>
    </div>
    <canvas ref={canvas} aria-hidden="true"/>
    <figcaption id="globe-caption">
      <div className="globe-person" aria-live="polite"><span><strong>{person.name}</strong><small>{person.location}{location.precision==='country'?' · country-level marker':''}</small></span><button type="button" onClick={()=>onChoose(person)}>Find in directory ↓</button></div>
      <p className="fineprint">Approximate city or country locations. {people.length-mapped.length} profiles have no mapped public location.</p>
    </figcaption>
  </figure>;
}
