import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {createHmac} from 'node:crypto';

export const sessionCookie='community_session';
export function config(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY,origin=process.env.APP_ORIGIN;
 if(!url||!key||!secret||!origin)throw new Error('Community service is not configured');
 return {url,key,secret,origin};
}
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
export function authClient(){const c=config();return createClient(c.url,c.key,options);}
export function adminClient(){const c=config();return createClient(c.url,c.secret,options);}
export function sameOrigin(req:Request){return req.headers.get('origin')===config().origin;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});}
export async function body(req:Request){if(!req.headers.get('content-type')?.startsWith('application/json'))throw Error('Invalid request');const text=await req.text();if(text.length>2048)throw Error('Invalid request');return JSON.parse(text);}
export function email(value:unknown){if(typeof value!=='string')return null;const normalized=value.trim().toLowerCase();return normalized.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)?normalized:null;}
export async function rateLimit(key:string,limit:number,seconds:number){
 const hash=createHmac('sha256',config().secret).update(key).digest('hex');
 const {data,error}=await adminClient().rpc('community_rate_limit',{p_key:hash,p_limit:limit,p_seconds:seconds});
 if(error)throw Error('Service unavailable');return data===true;
}
export async function memberClient(){
 const token=(await cookies()).get(sessionCookie)?.value;if(!token)return null;
 const c=config();const client=createClient(c.url,c.key,{...options,global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data,error}=await client.auth.getUser(token);if(error||!data.user?.email_confirmed_at)return null;return client;
}
export function claimError(message:string){
 const states:Record<string,[number,string]>={INELIGIBLE:[403,'This reward is not available to your account.'],UNVERIFIED:[401,'Verify your email to continue.'],UNAUTHENTICATED:[401,'Sign in to continue.'],ALREADY_ALLOCATED:[409,'Credits have already been allocated to this email identity. Contact Teemu for help.'],SOLD_OUT:[409,'All codes have been allocated.'],EXPIRED:[409,'This offer has ended.'],UNAVAILABLE:[409,'New claims are not open yet.']};
 for(const [code,[status,error]] of Object.entries(states))if(message.includes(code))return json({error,code},status);
 return json({error:'Could not complete the request. Please retry; retries do not allocate extra codes.'},503);
}
