import {body,claimError,json,memberClient,sameOrigin} from '../../../../lib/community';
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 const client=await memberClient();if(!client)return json({error:'Sign in to claim a reward.'},401);
 const input=await body(req);if(!['supabox','supabase-credits'].includes(input.family))return json({error:'This reward is not available yet.'},400);
 const {data,error}=await client.rpc('community_claim_reward',{p_family:input.family});return error?claimError(error.message):json(data);
 }catch{return json({error:'Could not complete the claim. You can safely retry.'},503);}}
