import {Detail,itemMetadata} from '../../content-pages';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){return itemMetadata('project',(await params).slug);}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <Detail kind='project' slug={(await params).slug}/>;}
