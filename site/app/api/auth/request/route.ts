import {adminClient,authClient,body,email,json,rateLimit,sameOrigin} from '../../../../lib/community';
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
  const address=email((await body(req)).email);if(!address)return json({error:'Enter a valid email address.'},400);
  // No client-supplied IP is trusted. A service-wide cap limits distributed address probing.
  const global=await rateLimit('login:global',60,3600);
  const cooldown=await rateLimit('login:'+address,1,60);
  if(!global||!cooldown)return json({error:'Please wait before requesting another code.'},429);
  const {data,error}=await adminClient().rpc('community_login_allowed',{p_email:address});if(error)throw error;
  if(data){const {error:sendError}=await authClient().auth.signInWithOtp({email:address,options:{shouldCreateUser:true}});if(sendError){
    // Do not expose provider messages, addresses, or membership status to callers.
    console.error('community_email_delivery_failed',sendError.status,sendError.code);
    return json({error:'Email sign-in is temporarily unavailable. Please try again later.'},503);
  }}
  return json({message:'If this email is registered, a sign-in code is on its way. Check your inbox and spam folder.'});
 }catch{return json({error:'Could not request a sign-in code. Please try again.'},503);}
}
