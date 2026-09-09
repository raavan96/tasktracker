'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// 1. Create Task
export async function createTask(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const assigneeId = (formData.get('assigneeId') as string) || null;
  const priority = formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent';
  const status = (formData.get('status') as 'todo' | 'in_progress' | 'blocked' | 'done') || 'todo';
  const dueDate = (formData.get('dueDate') as string) || null;

  if (!title) return { error: 'Task title is required' };

  const { error } = await supabase.from('tasks').insert({
    project_id: projectId,
    title,
    description,
    assignee_id: assigneeId,
    created_by: user?.id,
    priority,
    status,
    due_date: dueDate,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// 2. Update Task Details & Assignee
export async function updateTask(taskId: string, projectId: string, formData: FormData) {
  const supabase = await createClient();

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const assigneeId = (formData.get('assigneeId') as string) || null;
  const priority = formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent';
  const status = formData.get('status') as 'todo' | 'in_progress' | 'blocked' | 'done';
  const dueDate = (formData.get('dueDate') as string) || null;

  const { error } = await supabase
    .from('tasks')
    .update({
      title,
      description,
      assignee_id: assigneeId,
      priority,
      status,
      due_date: dueDate,
    })
    .eq('id', taskId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// 3. Quick Status Update (Assignable members can move task status)
export async function updateTaskStatus(
  taskId: string,
  projectId: string,
  newStatus: 'todo' | 'in_progress' | 'blocked' | 'done'
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// 4. Delete Task
export async function deleteTask(taskId: string, projectId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// 5. Comments
export async function addComment(taskId: string, projectId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!content.trim()) return { error: 'Comment cannot be empty' };

  const { error } = await supabase.from('task_comments').insert({
    task_id: taskId,
    author_id: user?.id,
    content: content.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function deleteComment(commentId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('task_comments').delete().eq('id', commentId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}