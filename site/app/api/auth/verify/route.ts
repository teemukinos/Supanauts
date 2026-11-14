import {cookies} from 'next/headers';
import {authClient,body,config,email,json,rateLimit,sameOrigin,sessionCookie} from '../../../../lib/community';
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
  const input=await body(req),address=email(input.email);
  if(!address||typeof input.token!=='string'||!/^\d{6,10}$/.test(input.token))return json({error:'Enter the code from your email.'},400);
  if(!await rateLimit('verify:'+address,8,600))return json({error:'Too many attempts. Wait ten minutes and request a new code.'},429);
  const {data,error}=await authClient().auth.verifyOtp({email:address,token:input.token,type:'email'});
  if(error||!data.session||!data.user?.email_confirmed_at)return json({error:'That code is invalid or expired. Request a new code.'},401);
  const store=await cookies();store.set(sessionCookie,data.session.access_token,{httpOnly:true,secure:config().origin.startsWith('https:'),sameSite:'strict',path:'/',maxAge:Math.min(data.session.expires_in,3600)});
  return json({ok:true});
 }catch{return json({error:'Could not verify your email. Please retry.'},503);}
}
