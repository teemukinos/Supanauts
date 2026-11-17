import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';
import {adminClient,json,memberClient,rateLimit,sameOrigin} from '../../../lib/community';
export const runtime='nodejs';export const maxDuration=300;
const exec=promisify(execFile);
export async function POST(req:Request){let folder='';try{
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);const client=await memberClient();if(!client)return json({error:'Sign in first.'},401);
 const membership=await client.rpc('community_member_home');if(membership.error)return json({error:'Active membership required.'},403);
 const user=await client.auth.getUser();if(!await rateLimit('upload:'+user.data.user?.id,20,3600))return json({error:'Upload limit reached. Try again later.'},429);
 if(Number(req.headers.get('content-length'))>105000000)return json({error:'Maximum file size is 100 MB.'},413);
 // Enforce a streaming limit before parsing multipart, including chunked requests.
 const reader=req.body?.getReader();if(!reader)throw Error('Choose a file.');const parts:Uint8Array[]=[];let total=0;
 while(true){const r=await reader.read();if(r.done)break;total+=r.value.byteLength;if(total>105000000){await reader.cancel();return json({error:'Maximum file size is 100 MB.'},413);}parts.push(r.value);}
 const form=await new Response(Buffer.concat(parts),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();const file=form.get('file');if(!(file instanceof File))throw Error('Choose an image or MP4.');
 let bytes:Buffer=Buffer.from(await file.arrayBuffer());let mime='image/webp';let duration:number|null=null;
 if(file.type.startsWith('image/')){if(file.size>10485760)throw Error('Images must be 10 MB or smaller.');const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();if(!['jpeg','png','webp'].includes(metadata.format||''))throw Error('Use JPEG, PNG or WebP.');bytes=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}
 else if(file.type==='video/mp4'){if(file.size>104857600)throw Error('Video must be 100 MB or smaller.');if(!process.env.FFMPEG_PATH||!process.env.FFPROBE_PATH)throw Error('Video processing is not enabled on this host. Add a demo link instead.');folder=await mkdtemp(join(tmpdir(),'supanauts-media-'));const input=join(folder,'input.mp4'),output=join(folder,'clean.mp4');await writeFile(input,bytes);const probe=await exec(process.env.FFPROBE_PATH,['-v','error','-show_entries','format=duration','-of','json',input],{timeout:30000});duration=Number(JSON.parse(probe.stdout).format.duration);if(!Number.isFinite(duration)||duration<=0||duration>90)throw Error('Video must be 90 seconds or shorter.');await exec(process.env.FFMPEG_PATH,['-nostdin','-v','error','-i',input,'-map','0:v:0','-map','0:a:0?','-map_metadata','-1','-vf','scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','fast','-crf','25','-c:a','aac','-movflags','+faststart',output],{timeout:240000});bytes=await readFile(output);mime='video/mp4';}
 else throw Error('Use JPEG, PNG, WebP or MP4.');
 const id=randomUUID();const registered=await client.rpc('community_register_media',{p_id:id,p_mime:mime,p_bytes:bytes.length,p_duration:duration});if(registered.error)throw Error('Could not register upload.');const {error}=await adminClient().storage.from('community-quarantine').upload(registered.data,bytes,{contentType:mime,upsert:false});if(error)throw Error('Upload failed. Retry with a new file.');return json({id,mime});
 }catch(e){return json({error:e instanceof Error?e.message:'Upload failed.'},400);}finally{if(folder)await rm(folder,{recursive:true,force:true});}}
