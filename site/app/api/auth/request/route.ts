import {createHmac} from 'node:crypto';
import {adminClient,body,email,json,rateLimit,sameOrigin} from '../../../../lib/community';
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
  const address=email((await body(req)).email);if(!address)return json({error:'Enter a valid email address.'},400);
  // No client-supplied IP is trusted. A service-wide cap limits distributed address probing.
  const global=await rateLimit('login:global',60,3600);
  const cooldown=await rateLimit('login:'+address,1,60);
  if(!global||!cooldown)return json({error:'Please wait before requesting another code.'},429);
  const {data,error}=await adminClient().rpc('community_login_allowed',{p_email:address});if(error)throw error;
  if(data){
   // Keep both credentials server-side. Never generate a login for an unapproved address.
   const key=process.env.RESEND_API_KEY,from=process.env.LOGIN_EMAIL_FROM;
   if(!key||!from||/[\r\n]/.test(from))throw Error('Login email is not configured');
   const {data:generated,error:generateError}=await adminClient().auth.admin.generateLink({type:'magiclink',email:address});
   const token=generated?.properties?.email_otp;
   if(generateError||!token||!/^\d{6,10}$/.test(token))throw Error('Could not generate login');
   // Supabase owns token verification and expiry. Resend only transports the OTP.
   // A keyed digest prevents duplicate delivery without exposing the OTP in metadata.
   const deliveryKey=createHmac('sha256',key).update(address+'\0'+token).digest('hex');
   const sent=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`supanauts-login-${deliveryKey}`},
    body:JSON.stringify({from,to:[address],subject:'Your Supanauts sign-in code',text:`Your Supanauts sign-in code is:\n\n${token}\n\nEnter it on the Supanauts page where you requested it. Use the most recent code.\n\nIf you did not request this email, you can ignore it. Never share this code.\n\nSupanauts — an unofficial Supabase community.`}),
    signal:AbortSignal.timeout(15000),cache:'no-store'
   });
   if(!sent.ok)throw Error('Login delivery failed');
   const receipt=await sent.json();if(typeof receipt.id!=='string'||!receipt.id)throw Error('Login delivery unconfirmed');
  }
  return json({message:'If this email is registered, a sign-in code is on its way. Check your inbox and spam folder.'});
 // Do not log tokens, generated links, addresses, credentials, or provider responses.
 }catch{return json({error:'Could not request a sign-in code. Please try again.'},503);}
}
