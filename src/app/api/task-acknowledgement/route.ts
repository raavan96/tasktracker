import {currentUser} from '@/lib/postgres/auth';
import {transaction} from '@/lib/postgres/db';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const user=await currentUser();if(!user)return json({error:'Please sign in again.'},401);
 const task=new URL(request.url).searchParams.get('task');if(!task||!uuid.test(task))return json({error:'Invalid task.'},400);
 return transaction(user.id,async db=>json({receipts:(await db.query('SELECT a.id,a.user_id,a.accepted_at,coalesce(p.full_name,p.email) name FROM task_acknowledgements a JOIN profiles p ON p.id=a.user_id WHERE a.task_id=$1 ORDER BY p.full_name,a.user_id',[task])).rows}));
}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return json({error:'Please sign in again.'},401);
 try{
 const origin=request.headers.get('origin');if(!origin||new URL(origin).host!==request.headers.get('host'))return json({error:'Invalid origin.'},403);
 const {id}=await request.json();if(typeof id!=='string'||!uuid.test(id))return json({error:'Invalid assignment.'},400);
 await transaction(user.id,db=>db.query('SELECT accept_task_assignment($1)',[id]));return json({success:true});
 }catch(e){return json({error:(e as {code?:string}).code==='P0001'?(e as Error).message:'Acceptance could not be confirmed. Please retry.'},400);}
}
