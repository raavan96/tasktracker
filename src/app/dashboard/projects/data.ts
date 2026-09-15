'use server';
import {createClient} from '@/lib/supabase/server';
import {workspaceRead} from '@/lib/workspace-data';
export async function projectTasks(projectId:string,archived:boolean,taskId?:string){
 const db=await createClient();
 let query=db.from('tasks').select('*,assignees:assigned_people(id,full_name,email,is_active),assignee:profiles!tasks_assignee_id_fkey(id,full_name,email,is_active),creator:task_creator(full_name,email),task_comments(count)').eq('project_id',projectId);
 if(taskId)query=query.eq('id',taskId);else if(!archived)query=query.eq('is_archived',false);
 const result=await query.order('created_at',{ascending:false});
 if(result.error)throw new Error('Tasks could not load. Please retry.');
 return (result.data||[]).map(t=>({...t,comment_count:t.task_comments?.[0]?.count||0,task_comments:[]}));
}
export async function projectNotes(projectId:string){
 const db=await createClient();const result=await db.from('project_notes').select('*,author:profiles!project_notes_author_id_fkey(id,full_name,email,is_active)').eq('project_id',projectId).order('created_at',{ascending:false});
 if(result.error)throw new Error('Notes could not load. Please retry.');return result.data||[];
}
export async function projectCounts(projectId:string){return workspaceRead(async db=>{
 const row=(await db.query<{tasks:string;archived:string;notes:string;unfinished:string;recurring:boolean}>("SELECT (SELECT count(*) FROM tasks WHERE project_id=$1) tasks,(SELECT count(*) FROM tasks WHERE project_id=$1 AND is_archived) archived,(SELECT count(*) FROM project_notes WHERE project_id=$1) notes,(SELECT count(*) FROM tasks WHERE project_id=$1 AND status<>'done') unfinished,EXISTS(SELECT 1 FROM tasks WHERE project_id=$1 AND recurrence<>'none') recurring",[projectId])).rows[0];
 return {tasks:Number(row.tasks),archived:Number(row.archived),notes:Number(row.notes),unfinished:Number(row.unfinished),recurring:row.recurring};
});}
