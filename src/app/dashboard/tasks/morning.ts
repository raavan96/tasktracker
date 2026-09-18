'use server';
import {workspaceRead} from '@/lib/workspace-data';
import {revalidatePath} from 'next/cache';
export async function morningTasks(){return workspaceRead(async(db,user)=>{
 const clock=(await db.query<{today:string;local_hour:number}>("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text today,extract(hour FROM now() AT TIME ZONE 'Asia/Kolkata')::int AS local_hour")).rows[0];
 const items=(await db.query<{id:string;title:string;project_id:string;due_date:string;review_version:number}>("SELECT id,title,project_id,due_date::text,review_version FROM tasks WHERE $1=ANY(assignee_ids) AND public.can_work_task(id) AND status IN ('todo','in_progress','blocked') AND due_date<(now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY due_date,id LIMIT 20",[user])).rows;
 return {...clock,items};
});}
export async function resolveMorningTask(id:string,version:number,action:'today'|'done'):Promise<{message?:string;error?:string}>{
 try{const result=await workspaceRead(async(db,user)=>{
  if(!Number.isSafeInteger(Number(version))||!['today','done'].includes(action))throw new Error('Invalid task action.');
  const task=(await db.query("SELECT * FROM tasks WHERE id=$1 AND $2=ANY(assignee_ids) AND public.can_work_task(id) AND status IN ('todo','in_progress','blocked') AND due_date<(now() AT TIME ZONE 'Asia/Kolkata')::date FOR UPDATE",[id,user])).rows[0];
  if(!task||Number(task.review_version)!==Number(version))throw new Error('This task changed. Refresh the prompt and try again.');
  if(action==='done')await db.query("SELECT public.review_task($1,$2,'submit','')",[id,version]);
  else await db.query("UPDATE tasks SET due_date=(now() AT TIME ZONE 'Asia/Kolkata')::date WHERE id=$1",[id]);
  return {message:action==='done'?'Submitted for review. The creator or an eligible admin can approve it.':'Rescheduled to today.'};
 });revalidatePath('/dashboard','layout');return result;
 }catch(e){return {error:e instanceof Error?e.message:'Could not update this task.'};}
}
