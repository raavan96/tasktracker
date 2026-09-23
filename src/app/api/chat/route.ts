import {currentUser} from '@/lib/postgres/auth';
import {transaction} from '@/lib/postgres/db';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const user=await currentUser();if(!user)return json({error:'Please sign in again.'},401);
 const params=new URL(request.url).searchParams,id=params.get('id'),before=params.get('before'),after=params.get('after');if(id&&!uuid.test(id)||before&&!/^\d{1,18}$/.test(before)||after&&!/^\d{1,18}$/.test(after))return json({error:'Invalid conversation.'},400);
 try{return await transaction(user.id,async db=>{
 await db.query('SELECT assert_active()');
 if(id){
 const c=(await db.query('SELECT id,project_id,user_a,user_b FROM chat_conversations WHERE id=$1',[id])).rows[0];if(!c)return json({error:'Conversation unavailable.'},403);
 const messages=(await db.query(`SELECT m.id::text,m.author_id,m.body,m.reply_id::text,m.created_at,coalesce(p.full_name,p.email) author,r.body reply_body,coalesce(rp.full_name,rp.email) reply_author FROM chat_messages m JOIN profiles p ON p.id=m.author_id LEFT JOIN chat_messages r ON r.id=m.reply_id LEFT JOIN profiles rp ON rp.id=r.author_id WHERE m.conversation_id=$1 AND ($2::bigint IS NULL OR m.id<$2) AND ($3::bigint IS NULL OR m.id>$3) ORDER BY ${after?'m.id ASC':'m.id DESC'} LIMIT 50`,[id,before,after])).rows;
 if(!after)messages.reverse();
 const members=(await db.query('SELECT id,coalesce(full_name,email) name FROM profiles WHERE is_active AND chat_allowed($1,id) ORDER BY full_name,id',[id])).rows;
 const archived=c.project_id?(await db.query('SELECT is_archived FROM projects WHERE id=$1',[c.project_id])).rows[0]?.is_archived:members.length<2;
 return json({messages,members,readOnly:!!archived});
 }
 const conversations=(await db.query(`SELECT c.id,c.project_id,CASE WHEN c.project_id IS NOT NULL THEN p.name ELSE coalesce(u.full_name,u.email) END name,last.body preview,last.created_at, (SELECT count(*)::int FROM chat_messages m WHERE m.conversation_id=c.id AND m.author_id<>$1 AND m.id>coalesce(r.last_id,0)) unread FROM chat_conversations c LEFT JOIN projects p ON p.id=c.project_id LEFT JOIN profiles u ON u.id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END LEFT JOIN chat_reads r ON r.conversation_id=c.id AND r.user_id=$1 LEFT JOIN LATERAL(SELECT body,created_at FROM chat_messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) last ON true ORDER BY last.created_at DESC NULLS LAST,c.id`,[user.id])).rows;
 const people=(await db.query('SELECT id,coalesce(full_name,email) name FROM profiles WHERE is_active AND id<>$1 ORDER BY full_name,id',[user.id])).rows;
 const projects=(await db.query('SELECT id,name FROM projects p WHERE NOT is_archived AND (created_by=$1 OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1)) ORDER BY name,id',[user.id])).rows;
 return json({conversations,people,projects});
 });}catch{return json({error:'Could not load chats. Please retry.'},500);}
}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return json({error:'Please sign in again.'},401);
 const origin=request.headers.get('origin');if(!origin||new URL(origin).host!==request.headers.get('host'))return json({error:'Invalid request origin.'},403);
 try{
 const text=await request.text();if(text.length>20000)return json({error:'Message too large.'},400);const data=JSON.parse(text);
 return await transaction(user.id,async db=>{await db.query('SELECT assert_active()');
 if(data.action==='open'&&((uuid.test(data.project||'')&&!data.person)||(uuid.test(data.person||'')&&!data.project)))return json((await db.query('SELECT open_chat($1,$2) id',[data.project||null,data.person||null])).rows[0]);
 if(!uuid.test(data.id||''))return json({error:'Invalid conversation.'},400);
 if(data.action==='read'&&/^\d{1,18}$/.test(String(data.upto))){await db.query('SELECT read_chat($1,$2)',[data.id,data.upto]);return json({success:true});}
 if(data.action==='send'&&typeof data.body==='string'&&data.body.trim().length<=4000&&uuid.test(data.nonce||'')&&Array.isArray(data.mentions)&&data.mentions.length<=30&&data.mentions.every((id:unknown)=>typeof id==='string'&&uuid.test(id))&&(!data.reply||/^\d{1,18}$/.test(String(data.reply))))return json((await db.query('SELECT send_chat($1,$2,$3,$4::uuid[],$5)::text id',[data.id,data.body,data.reply||null,data.mentions,data.nonce])).rows[0]);
 return json({error:'Invalid chat request.'},400);
 });
 }catch(error){const e=error as {code?:string;message?:string};return json({error:e.code==='P0001'?e.message:'Could not save. Retry the same message to avoid duplicates.'},400);}
}
