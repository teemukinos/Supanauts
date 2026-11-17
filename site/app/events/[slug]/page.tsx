import {Detail,itemMetadata} from '../../content-pages';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){return itemMetadata('event',(await params).slug);}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <Detail kind='event' slug={(await params).slug}/>;}
