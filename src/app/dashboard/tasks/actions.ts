'use server';

import { revalidatePath } from 'next/cache';
import { projectAccess, checkAssignee } from '@/lib/project-access';
import { parseTaskForm, type TaskStatus } from '@/lib/task-types';

function refreshTasks(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard/my-tasks');
  revalidatePath('/dashboard','layout');
}

async function taskAccess(taskId: string, projectId: string, mode: 'edit' | 'status' | 'comment' | 'delete') {
  const access = await projectAccess(projectId);
  if (access.error) return access;
  const { data: task } = await access.supabase.from('tasks').select('id, created_by, assignee_id, status, is_archived').eq('id', taskId).eq('project_id', projectId).single();
  if (task?.is_archived) return {error:'Restore this task before making changes.'} as const;
  if (!task) return { error: 'Task not found or access denied.' } as const;
  if (mode !== 'comment' && !access.isAdmin && task.created_by !== access.user.id && !(mode === 'status' && task.assignee_id === access.user.id)) {
    return { error: mode === 'status' ? 'Only an admin, the task creator, or the assignee can change this status.' : 'Only an admin or the task creator can edit or delete this task.' } as const;
  }
  return { ...access, taskStatus: task.status };
}

export async function createTask(projectId: string, formData: FormData) {
  const access = await projectAccess(projectId);
  if (access.error) return { error: access.error };
  const parsed = parseTaskForm(formData);
  if (parsed.error) return { error: parsed.error };
  if (parsed.data.status === 'done' && !access.isAdmin) return { error: 'Submit for review. Only admins approve completion.' };
  const assignmentError = await checkAssignee(access.supabase, projectId, parsed.data.assignee_id);
  if (assignmentError) return { error: assignmentError };
  const { data, error } = await access.supabase.from('tasks').insert({ ...parsed.data, project_id: projectId, created_by: access.user.id }).select('id').single();
  if (error || !data) return { error: error?.message || 'The task could not be created.' };
  refreshTasks(projectId);
  return { success: true };
}

export async function updateTask(taskId: string, projectId: string, formData: FormData) {
  const access = await taskAccess(taskId, projectId, 'edit');
  if (access.error) return { error: access.error };
  const parsed = parseTaskForm(formData);
  if (parsed.error) return { error: parsed.error };
  if (parsed.data.status === 'done' && !access.isAdmin && access.taskStatus !== 'done') return { error: 'Submit for review. Only admins approve completion.' };
  const assignmentError = await checkAssignee(access.supabase, projectId, parsed.data.assignee_id);
  if (assignmentError) return { error: assignmentError };
  const version=Number(formData.get('reviewVersion'));if(!formData.has('reviewVersion')||!Number.isSafeInteger(version)||version<0)return {error:'This task changed. Load the latest version before editing.'};
  const { data, error } = await access.supabase.from('tasks').update(parsed.data).eq('id', taskId).eq('project_id', projectId).eq('review_version',version).select('id').single();
  if (error || !data) return { error: error?.message&&!error.message.includes('Record not found')?error.message:'This task changed or access was removed. Your draft is kept; load the latest version before retrying.' };
  refreshTasks(projectId);
  return { success: true };
}

export async function updateTaskStatus(taskId: string, projectId: string, newStatus: TaskStatus, version?:number) {
  if(version===undefined||!Number.isSafeInteger(version)||version<0)return {error:'This task changed. Load the latest version before updating.'};
  if (!['todo', 'in_progress', 'blocked', 'in_review', 'done'].includes(newStatus)) return { error: 'Choose a valid status.' };
  const access = await taskAccess(taskId, projectId, 'status');
  if (access.error) return { error: access.error };
  if (newStatus === 'done' || newStatus === 'in_review') return { error: 'Use the task’s Review section to submit or approve.' };
  const { data, error } = await access.supabase.from('tasks').update({ status: newStatus }).eq('id', taskId).eq('project_id', projectId).eq('review_version',version).select('id').single();
  if (error || !data) return { error: error?.message || 'The status could not be updated.' };
  refreshTasks(projectId);
  return { success: true };
}

export async function deleteTask(taskId: string, projectId: string) {
  const access = await taskAccess(taskId, projectId, 'delete');
  if (access.error) return { error: access.error };
  const { data, error } = await access.supabase.from('tasks').delete().eq('id', taskId).eq('project_id', projectId).select('id').single();
  if (error || !data) return { error: error?.message || 'The task could not be deleted.' };
  refreshTasks(projectId);
  return { success: true };
}

export async function addComment(taskId: string, projectId: string, content: string) {
  if (!content.trim()) return { error: 'Write an update before sending.' };
  if (content.length > 10000) return { error: 'Keep updates under 10,000 characters.' };
  const access = await taskAccess(taskId, projectId, 'comment');
  if (access.error) return { error: access.error };
  const { error } = await access.supabase.from('task_comments').insert({ task_id: taskId, author_id: access.user.id, content: content.trim() });
  if (error) return { error: error.message };
  refreshTasks(projectId);
  return { success: true };
}

export async function deleteComment(commentId: string, projectId: string) {
  const access = await projectAccess(projectId);
  if (access.error) return { error: access.error };
  const { data: comment } = await access.supabase.from('task_comments').select('author_id, task_id').eq('id', commentId).single();
  if (!comment || (!access.isAdmin && comment.author_id !== access.user.id)) return { error: 'You cannot delete this comment.' };
  const task = await taskAccess(comment.task_id, projectId, 'comment');
  if (task.error) return { error: task.error };
  const { error } = await access.supabase.from('task_comments').delete().eq('id', commentId);
  if (error) return { error: error.message };
  refreshTasks(projectId);
  return { success: true };
}
