import {cookies} from 'next/headers';
import {adminClient,json,sameOrigin,sessionCookie} from '../../../../lib/community';
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 const store=await cookies(),token=store.get(sessionCookie)?.value;
 if(token)await adminClient().auth.admin.signOut(token,'local');
 store.delete(sessionCookie);return json({ok:true});
}
