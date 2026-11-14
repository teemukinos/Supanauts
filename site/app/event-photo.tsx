'use client';

const fallback='/illustrations/community-placeholder.svg';
/** Event photos are supplied separately, only when their distribution is authorized. */
export default function EventPhoto({file,alt,className}:{file:string;alt:string;className?:string}){
 const base=process.env.NEXT_PUBLIC_EVENT_MEDIA_BASE_URL?.replace(/\/$/,'');
 return <img className={className} src={base?`${base}/${file}`:fallback}
  alt={base?alt:'Original Supanauts illustration; event photography is not included in this checkout'}
  onError={event=>{if(!event.currentTarget.src.endsWith(fallback)){event.currentTarget.src=fallback;event.currentTarget.alt='Original Supanauts illustration; event photography unavailable';}}}/>;
}
