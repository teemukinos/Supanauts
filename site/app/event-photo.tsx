'use client';
import {useEffect,useRef,useState} from 'react';
import {eventMediaBase as base} from '../lib/event-media';
const fallback='/illustrations/community-placeholder.svg';
/** Event photos are supplied separately, only when their distribution is authorized. */
export default function EventPhoto({file,alt,className,priority=false,width=1600,height=1067,thumbnail=false}:{file:string;alt:string;className?:string;priority?:boolean;width?:number;height?:number;thumbnail?:boolean}){
 const [failed,setFailed]=useState(false);const image=useRef<HTMLImageElement>(null);
 const src=base&&!failed?`${base}/${file}`:fallback;
 const small=base&&!failed&&thumbnail&&file.startsWith('restored/')?`${base}/${file.replace(/\.webp$/,'-small.webp')}`:undefined;
 // Handle images that fail before hydration as well as later network failures.
 useEffect(()=>{if(image.current?.complete&&image.current.naturalWidth===0)setFailed(true);},[src]);
 return <img ref={image} width={width} height={height} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" className={className} src={small||src}
  srcSet={small?`${small} ${Math.round(width/2)}w, ${src} ${width}w`:undefined} sizes={small?'(max-width: 800px) 88vw, 30vw':undefined}
  alt={base&&!failed?alt:'Original Supanauts illustration; event photography unavailable'}
  onError={()=>{if(!failed)setFailed(true);}}/>;
}
