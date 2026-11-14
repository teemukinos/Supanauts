import {adminClient,body,email,json,rateLimit,sameOrigin} from '../../../../lib/community';
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 const input=await body(req),address=email(input.email);
 if(!address||typeof input.name!=='string'||!input.name.trim()||input.name.length>100||typeof input.reason!=='string'||input.reason.trim().length<10||input.reason.length>1000)return json({error:'Enter your name, email and a short introduction (10–1000 characters).'},400);
 if(!await rateLimit('access:global',30,3600)||!await rateLimit('access:'+address,2,86400))return json({error:'Please wait before sending another request.'},429);
 const {error}=await adminClient().rpc('community_submit_request',{p_email:address,p_name:input.name,p_reason:input.reason});if(error)throw error;
 return json({message:'Your request has been recorded. Teemu reviews new applicants. You can try signing in after approval; no automatic email notification is sent yet.'});
}catch{return json({error:'Could not save your request. Please try again later.'},503);}}
