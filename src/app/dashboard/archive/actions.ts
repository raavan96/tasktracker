'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
export async function changeArchive(kind: 'project' | 'task', id: string, archived: boolean, confirmUnfinished = false, complete = false) {
  const db=await createClient();
  const {error}=await db.rpc('set_archive',{p_kind:kind,p_id:id,p_archived:archived,p_confirm_unfinished:confirmUnfinished,p_complete:complete});
  if(error)return {error:error.message};
  revalidatePath('/dashboard','layout');
  return {success:true};
}
export async function bulkArchive(projectId:string,days:number) {
  const db=await createClient();
  const {data,error}=await db.rpc('bulk_archive_tasks',{p_project_id:projectId,p_days:days});
  if(error)return {error:error.message};
  revalidatePath('/dashboard','layout');return {success:true,count:Number(data)};
}
export async function saveArchiveSettings(form:FormData) {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return {error:'Please sign in again.'};
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();
  if(profile?.role!=='admin')return {error:'Only admins can change automatic archiving.'};
  const taskDays=Number(form.get('task_days')),projectDays=Number(form.get('project_days'));
  if(![taskDays,projectDays].every(n=>Number.isInteger(n)&&n>=1&&n<=3650))return {error:'Choose a whole number of days between 1 and 3650.'};
  const {error}=await db.from('archive_settings').update({task_days:taskDays,project_days:projectDays,tasks_enabled:form.get('tasks_enabled')==='on',projects_enabled:form.get('projects_enabled')==='on',updated_at:new Date().toISOString()}).eq('id',true).select('id').single();
  if(error)return {error:error.message};
  revalidatePath('/dashboard/archive');return {success:true};
}
