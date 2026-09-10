'use server';
import { createClient } from '@/lib/supabase/server';
import { projectAccess } from '@/lib/project-access';
import { revalidatePath } from 'next/cache';
async function accessTask(taskId: string, projectId: string) {
  const access = await projectAccess(projectId);
  if (access.error) return access;
  const { data } = await access.supabase.from('tasks').select('id,created_by,assignee_id').eq('id',taskId).eq('project_id',projectId).single();
  if (!data) return { error: 'Task not found.' } as const;
  if (!access.isAdmin && data.created_by !== access.user.id && data.assignee_id !== access.user.id) return { error: 'Only the creator, assignee, or admin can change task details.' } as const;
  return access;
}
export async function getTaskExtras(taskId: string, projectId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase.from('tasks').select('id').eq('id',taskId).eq('project_id',projectId).single();
  if (!task) return { error: 'Task not found or access denied.' };
  const [checklist, history, dependencies, attachments] = await Promise.all([
    supabase.from('task_checklist').select('*').eq('task_id',taskId).order('created_at'),
    supabase.from('task_history').select('*,actor:profiles(full_name,email)').eq('task_id',taskId).order('created_at',{ascending:false}).limit(100),
    supabase.from('task_dependencies').select('depends_on').eq('task_id',taskId),
    supabase.from('task_attachments').select('*').eq('task_id',taskId).order('created_at'),
  ]);
  if ([checklist,history,dependencies,attachments].some(r=>r.error)) return {error:'Task details could not load. Check that the workspace migration is installed.'};
  return { checklist:checklist.data || [], history:history.data || [], dependencies:dependencies.data || [], attachments:attachments.data || [] };
}
export async function saveChecklist(taskId:string, projectId:string, title:string, itemId?:string, completed?:boolean) {
  const access=await accessTask(taskId,projectId); if(access.error) return {error:access.error};
  if (!itemId && (!title.trim() || title.trim().length>300)) return {error:'Enter a checklist item (1–300 characters).'};
  const result=itemId
    ? await access.supabase.from('task_checklist').update({completed:!!completed}).eq('id',itemId).eq('task_id',taskId).select('id').single()
    : await access.supabase.from('task_checklist').insert({task_id:taskId,title:title.trim()}).select('id').single();
  if(result.error || !result.data)return {error:result.error?.message || 'Checklist item not saved.'};
  revalidatePath(`/dashboard/projects/${projectId}`); return {success:true};
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
