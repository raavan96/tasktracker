'use server';
import {workspaceRead} from '@/lib/workspace-data';
import {revalidatePath} from 'next/cache';
export type Schedule={task_id:string;project_id:string;created_by:string;title:string;description:string|null;priority:string;assignee_id:string|null;frequency:string;anchor_date:string;next_run:string;end_date:string|null;paused:boolean;version:number;held:boolean;archived:boolean;can_edit:boolean};
export async function getSchedule(task:string){return workspaceRead(async db=>{
 const schedule=(await db.query<Schedule>('SELECT s.*,NOT public.member_active(s.created_by) OR (s.assignee_id IS NOT NULL AND NOT public.member_active(s.assignee_id)) held,(t.is_archived OR p.is_archived) archived,(public.is_admin() OR s.created_by=auth.uid()) can_edit FROM task_schedules s JOIN tasks t ON t.id=s.task_id JOIN projects p ON p.id=s.project_id WHERE s.task_id=$1',[task])).rows[0]||null;
 const events=(await db.query<{id:string;description:string;created_at:string}>('SELECT id,description,created_at FROM schedule_events WHERE task_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25',[task])).rows;return {schedule,events};
});}
export async function saveSchedule(task:string,version:number,form:FormData){try{return await workspaceRead(async(db)=>{
 await db.query('SELECT save_task_schedule($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[task,version,String(form.get('title')||''),String(form.get('description')||''),String(form.get('priority')||''),String(form.get('assignee')||'')||null,String(form.get('frequency')||''),String(form.get('next')||''),String(form.get('end')||'')||null,form.get('paused')==='on']);
 revalidatePath('/dashboard','layout');return {error:''};
 });}catch(e){return {error:e instanceof Error?e.message:'Schedule could not be saved.'};}}
