'use client';
import {useRef,useState} from 'react';
import {eventFilms} from '../lib/event-films';

export default function EventFilms({initialFilm='roadshow'}:{initialFilm?:string}){
  const [selected,setSelected]=useState(Math.max(0,eventFilms.findIndex(film=>film.id===initialFilm)));
  const [started,setStarted]=useState(false);
  const [error,setError]=useState(false);
  const video=useRef<HTMLVideoElement>(null);
  const film=eventFilms[selected];
  const base=process.env.NEXT_PUBLIC_EVENT_MEDIA_BASE_URL;
  const poster=base?`${base}/${film.poster}`:'/illustrations/community-placeholder.svg';
  function choose(index:number){
    if(index===selected)return;
    video.current?.pause();
    setStarted(false);setError(false);setSelected(index);
    if(window.matchMedia('(min-width: 801px)').matches)requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.film-play')?.focus());
  }
  function play(){
    const player=video.current;
    if(!player||!base)return;
    setError(false);setStarted(true);
    // Assign only inside the user's Play action: no video request on page load.
    player.src=`${base}/${film.video}`;
    player.load();
    void player.play().catch(()=>{if(video.current===player)setError(true);});
  }
  return <section className="section event-films" aria-labelledby="films-heading" id="films">
    <div className="section-heading"><h2 id="films-heading">Supabase builders.<br/><span>In the same room.</span></h2><span className="eyebrow">FROM THE MEETUPS</span></div>
    <div className="film-layout">
      <div className="film-main">
        <div className="portrait-player">
          <video key={film.id} ref={video} poster={poster} width={720} height={1280} controls={started&&!error} playsInline preload="none" aria-label={`${film.title} film`} aria-describedby="film-summary" onError={()=>setError(true)}>
            {film.captions&&base&&<track kind="captions" src={`${base}/${film.captions}`} srcLang="en" label="English" default/>}
          </video>
          {!started&&!error&&<button className="film-play" onClick={play} disabled={!base} aria-label={`Play ${film.title} film`}><span aria-hidden="true">▶</span>{base?'Play film':'Film unavailable'}</button>}
          {error&&<div className="film-error" role="alert"><p>This film could not play.</p><button className="primary" onClick={play}>Try again</button></div>}
        </div>
        <div className="film-caption"><strong>{film.title}</strong><span>{film.duration}</span></div>
        <details className="film-description"><summary>Film description</summary><p id="film-summary">{film.summary}</p></details>
      </div>
      <div className="film-choices" role="group" aria-label="Choose an event film">
        {eventFilms.map((item,index)=><button key={item.id} type="button" aria-pressed={selected===index} onClick={()=>choose(index)} className={`film-choice ${selected===index?'selected':''}`}>
          <img src={base?`${base}/${item.poster}`:'/illustrations/community-placeholder.svg'} alt="" width={720} height={1280} loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/illustrations/community-placeholder.svg';}}/>
          <span><strong>{item.title}</strong><small>{item.duration}</small></span>
        </button>)}
      </div>
    </div>
    <div className="film-links"><a href="/events">All meetups ↗</a><a href="/community/photos">Photos ↗</a></div>
  </section>;
}
