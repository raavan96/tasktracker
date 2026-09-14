import {previewMime} from '@/lib/attachment-preview';
import { currentUser } from '@/lib/postgres/auth';
import { transaction } from '@/lib/postgres/db';
import { readAttachment } from '@/lib/postgres/storage';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(process.env.DATA_BACKEND!=='postgres')return new Response(null,{status:404});
  const user=await currentUser();if(!user)return new Response(null,{status:401});
  const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return new Response(null,{status:404});
  const rows=await transaction(user.id,async db=>(await db.query('SELECT name,storage_path FROM task_attachments WHERE id=$1',[id])).rows);
  if(!rows.length)return new Response(null,{status:404});
  try{const bytes=new Uint8Array(await readAttachment(rows[0].storage_path));const mime=previewMime(bytes);const query=new URL(_request.url).searchParams;
    if(query.get('info')==='1')return Response.json({mime,name:rows[0].name},{headers:{'Cache-Control':'private, no-store'}});
    const preview=query.get('preview')==='1';if(preview&&!mime)return new Response('This file is download-only.',{status:415});
    return new Response(bytes,{headers:{
    'Content-Type':preview?mime!:'application/octet-stream','Content-Disposition':`${preview?'inline':'attachment'}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(rows[0].name).replace(/'/g,'%27')}`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    ...(preview?{'Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'self'",'Referrer-Policy':'no-referrer'}:{}),
  }});}catch{return new Response('Attachment unavailable.',{status:404});}
}
