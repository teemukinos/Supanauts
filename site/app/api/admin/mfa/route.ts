import {cookies} from 'next/headers';
import {body,config,json,memberClient,rateLimit,sameOrigin,sessionCookie} from '../../../../lib/community';
async function guard(){const c=await memberClient();if(!c)return null;const {data,error}=await c.rpc('community_admin_status');return !error&&data?c:null;}
async function provider(path:string,data?:object){const token=(await cookies()).get(sessionCookie)?.value;const c=config();const r=await fetch(c.url+'/auth/v1/'+path,{method:data?'POST':'GET',headers:{apikey:c.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store'});if(!r.ok)throw Error('Authenticator verification failed. Check your code and retry.');return r.json();}
export async function GET(){try{if(!await guard())return json({error:'Administrator access required. Sign in with your organizer email.'},403);const user=await provider('user');return json({factors:(user.factors??[]).filter((f:{factor_type:string;status:string})=>f.factor_type==='totp'&&f.status==='verified').map((f:{id:string})=>({id:f.id}))});}catch{return json({error:'Could not load authenticator settings.'},503);}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 if(!await guard())return json({error:'Administrator access required.'},403);
 const input=await body(req);
 if(input.action==='enroll'){
  if(!await rateLimit('admin:mfa:enroll',3,3600))return json({error:'Too many setup attempts. Try again later.'},429);
  const data=await provider('factors',{factor_type:'totp',friendly_name:'Community approvals '+new Date().toISOString().slice(0,16),issuer:'Supabase community'});
  return json({id:data.id,qr_code:data.totp.qr_code,secret:data.totp.secret});
 }
 if(input.action!=='verify'||typeof input.factor!=='string'||! /^[a-f0-9-]{36}$/.test(input.factor)||typeof input.code!=='string'||! /^\d{6}$/.test(input.code))return json({error:'Enter your six-digit authenticator code.'},400);
 if(!await rateLimit('admin:mfa:verify',8,600))return json({error:'Too many attempts. Wait ten minutes.'},429);
 const challenge=await provider('factors/'+input.factor+'/challenge',{});
 const verified=await provider('factors/'+input.factor+'/verify',{challenge_id:challenge.id,code:input.code});
 if(typeof verified.access_token!=='string')throw Error('Authenticator verification failed.');
 (await cookies()).set(sessionCookie,verified.access_token,{httpOnly:true,secure:config().origin.startsWith('https:'),sameSite:'strict',path:'/',maxAge:Math.min(verified.expires_in??3600,3600)});
 return json({ok:true});
}catch(e){return json({error:e instanceof Error?e.message:'Authenticator verification failed.'},400);}}
