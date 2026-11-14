import 'server-only';
import {authClient} from './community';
export type ContentData={title:string;description:string;date_label?:string;body?:string;city?:string;starts_at?:string;ends_at?:string;timezone?:string;venue?:string;registration_url?:string;cancelled?:boolean;resources?:{title:string;url:string}[];supporters?:{name:string;role:string;url:string}[];promotion_permission?:boolean;media?:string[];maker?:string;maker_link?:string;technologies?:string;learned?:string;help?:string;demo_url?:string;repository_url?:string;event?:string};
export type ContentItem={id:string;kind:'event'|'story';slug:string;data:ContentData;published_at:string};
export type ProjectItem={id:string;slug:string;revision:string;data:ContentData;published_at:string};
export type RewardOffer={family:string;title:string;details:{eligibility?:string;value?:string;instructions?:string;redemption_url?:string;deadline?:string};state:string;available:number|null};
export type PublicCommunity={content:ContentItem[];projects:ProjectItem[];whatsapp:{announcements?:string;builders?:string};rewards:RewardOffer[];updated_at?:string;unavailable?:boolean;preview?:boolean};
export async function publicCommunity():Promise<PublicCommunity>{try{const {data,error}=await authClient().rpc('community_public');if(error)throw error;return data;}catch{return {content:[],projects:[],whatsapp:{},rewards:[],unavailable:true,preview:!process.env.SUPABASE_URL};}}
export function siteOrigin(){return process.env.PUBLIC_SITE_ORIGIN||process.env.APP_ORIGIN||'http://127.0.0.1:3018';}
export function absolute(path:string){return new URL(path,siteOrigin()).toString();}
export function contentPath(kind:string,slug:string){return `/${kind==='project'?'projects':kind==='event'?'events':'stories'}/${encodeURIComponent(slug)}`;}
