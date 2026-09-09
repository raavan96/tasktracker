'use server';

import { revalidatePath } from 'next/cache';
import { projectAccess, checkAssignee } from '@/lib/project-access';
import { parseTaskForm, type TaskStatus } from '@/lib/task-types';

function refreshTasks(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard/my-tasks');
  revalidatePath('/dashboard');
}

async function taskAccess(taskId: string, projectId: string, mode: 'edit' | 'status' | 'comment') {
  const access = await projectAccess(projectId);
  if (access.error) return access;
  const { data: task } = await access.supabase.from('tasks').select('id, created_by, assignee_id').eq('id', taskId).eq('project_id', projectId).single();
  if (!task) return { error: 'Task not found or access denied.' } as const;
  if (mode !== 'comment' && !access.isAdmin && task.created_by !== access.user.id && !(mode === 'status' && task.assignee_id === access.user.id)) {
    return { error: mode === 'edit' ? 'Only an admin or the task creator can edit this task.' : 'Only an admin, the task creator, or the assignee can change this status.' } as const;
  }
  return access;
}

export async function createTask(projectId: string, formData: FormData) {
  const access = await projectAccess(projectId);
  if (access.error) return { error: access.error };
  const parsed = parseTaskForm(formData);
  if (parsed.error) return { error: parsed.error };
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
  const assignmentError = await checkAssignee(access.supabase, projectId, parsed.data.assignee_id);
  if (assignmentError) return { error: assignmentError };
  const { data, error } = await access.supabase.from('tasks').update(parsed.data).eq('id', taskId).eq('project_id', projectId).select('id').single();
  if (error || !data) return { error: error?.message || 'The task could not be updated. Refresh and try again.' };
  refreshTasks(projectId);
  return { success: true };
}

export async function updateTaskStatus(taskId: string, projectId: string, newStatus: TaskStatus) {
  if (!['todo', 'in_progress', 'blocked', 'done'].includes(newStatus)) return { error: 'Choose a valid status.' };
  const access = await taskAccess(taskId, projectId, 'status');
  if (access.error) return { error: access.error };
  const { data, error } = await access.supabase.from('tasks').update({ status: newStatus }).eq('id', taskId).eq('project_id', projectId).select('id').single();
  if (error || !data) return { error: error?.message || 'The status could not be updated.' };
  refreshTasks(projectId);
  return { success: true };
}

export async function deleteTask(taskId: string, projectId: string) {
  const access = await taskAccess(taskId, projectId, 'edit');
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
