'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createNote(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();

  if (!title || !content) return { error: 'Title and content are required' };

  const { error } = await supabase.from('project_notes').insert({
    project_id: projectId,
    author_id: user?.id,
    title,
    content,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function updateNote(noteId: string, projectId: string, formData: FormData) {
  const supabase = await createClient();

  const title = (formData.get('title') as string)?.trim();
  const content = (formData.get('content') as string)?.trim();

  const { error } = await supabase
    .from('project_notes')
    .update({ title, content })
    .eq('id', noteId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function deleteNote(noteId: string, projectId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('project_notes').delete().eq('id', noteId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}