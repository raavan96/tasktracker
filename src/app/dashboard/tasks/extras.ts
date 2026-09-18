'use server';
import {assignedIds} from '@/lib/task-types';

import { createClient } from '@/lib/supabase/server';
import { projectAccess } from '@/lib/project-access';
import { revalidatePath } from 'next/cache';
async function accessTask(taskId: string, projectId: string) {
  const access = await projectAccess(projectId);
  if (access.error) return access;
  const { data } = await access.supabase.from('tasks').select('id,created_by,assignee_id,assignee_ids,is_archived').eq('id',taskId).eq('project_id',projectId).single();
  if(data?.is_archived)return {error:'Restore this task before making changes.'} as const;
  if (!data) return { error: 'Task not found.' } as const;
  if (!access.isAdmin && data.created_by !== access.user.id && !assignedIds(data).includes(access.user.id)) return { error: 'Only the creator, assignee, or admin can change task details.' } as const;
  return access;
}
export async function getTaskExtras(taskId: string, projectId: string, historyPage=0, section: 'details' | 'updates' | 'all' = 'all') {
  if(!Number.isInteger(historyPage)||historyPage<0||historyPage>10000)return {error:'Invalid history page.'};
  const supabase = await createClient();
  const { data: task } = await supabase.from('tasks').select('id').eq('id',taskId).eq('project_id',projectId).single();
  if (!task) return { error: 'Task not found or access denied.' };
  const [checklist, history, dependencies, attachments, reviews, taskOptions] = await Promise.all([
    section==='updates' ? Promise.resolve({data:[],error:null}) : supabase.from('task_checklist').select('*').eq('task_id',taskId).order('created_at'),
    section==='details' ? Promise.resolve({data:[],error:null}) : supabase.from('task_history').select('*,actor:profiles(full_name,email)').eq('task_id',taskId).order('created_at',{ascending:false}).range(historyPage*100,historyPage*100+99),
    section==='updates' ? Promise.resolve({data:[],error:null}) : supabase.from('task_dependencies').select('depends_on').eq('task_id',taskId),
    section==='updates' ? Promise.resolve({data:[],error:null}) : supabase.from('task_attachments').select('*').eq('task_id',taskId).order('created_at'),
    section==='details' ? Promise.resolve({data:[],error:null}) : supabase.from('task_reviews').select('*,actor:profiles(full_name,email)').eq('task_id',taskId).order('created_at',{ascending:false}).range(historyPage*100,historyPage*100+99),
    section==='updates' ? Promise.resolve({data:[],error:null}) : supabase.from('tasks').select('id,title,status,is_archived').eq('project_id',projectId).order('title'),
  ]);
  if ([checklist,history,dependencies,attachments,reviews,taskOptions].some(r=>r.error)) return {error:'Task details could not load. Check that the workspace migration is installed.'};
  return {taskOptions:taskOptions.data||[],historyMore:(history.data?.length===100||reviews.data?.length===100), reviews:reviews.data||[], checklist:checklist.data || [], history:history.data || [], dependencies:dependencies.data || [], attachments:attachments.data || [] };
}
export async function setDependency(taskId:string, projectId:string, dependsOn:string, remove=false) {
  const access=await accessTask(taskId,projectId); if(access.error)return {error:access.error};
  const { data: other }=await access.supabase.from('tasks').select('id').eq('id',dependsOn).eq('project_id',projectId).single();
  if(!other || taskId===dependsOn)return {error:'Choose another task in this project.'};
  const result=remove?await access.supabase.from('task_dependencies').delete().eq('task_id',taskId).eq('depends_on',dependsOn):await access.supabase.from('task_dependencies').insert({task_id:taskId,depends_on:dependsOn});
  if(result.error)return {error:result.error.message};
  revalidatePath(`/dashboard/projects/${projectId}`);return {success:true};
}
export async function uploadAttachment(taskId:string,projectId:string,form:FormData) {
  const access=await accessTask(taskId,projectId);if(access.error)return {error:access.error};
  const file=form.get('file');
  if(!(file instanceof File) || file.size===0 || file.size>10*1024*1024)return {error:'Choose a file up to 10 MB.'};
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-150) || 'attachment';
  const path=`${taskId}/${crypto.randomUUID()}/${safeName}`;
  const storage=access.supabase.storage.from('task-files');
  const { error }=await storage.upload(path,file,{contentType:'application/octet-stream',upsert:false});
  if(error)return {error:error.message};
  const {error:metaError}=await access.supabase.from('task_attachments').insert({task_id:taskId,uploaded_by:access.user.id,name:file.name.slice(0,250),storage_path:path,size:file.size});
  if(metaError){await storage.remove([path]);return {error:'File metadata could not be saved. Please retry.'};}
  return {success:true};
}
export async function attachmentLink(id:string) {
  const supabase=await createClient();
  const {data}=await supabase.from('task_attachments').select('storage_path,name').eq('id',id).single();
  if(!data)return {error:'Attachment not found or access denied.'};
  const {data:link,error}=await supabase.storage.from('task-files').createSignedUrl(data.storage_path,60,{download:data.name});
  if(error)return {error:error.message};return {url:link.signedUrl};
}
