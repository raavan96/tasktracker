'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// 1. Create Project (Admin only)
export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const name = (formData.get('name') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const memberIds = formData.getAll('members') as string[];

  if (!name) return { error: 'Project name is required' };

  // Insert project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name,
      description,
      created_by: user?.id,
    })
    .select()
    .single();

  if (projectError) return { error: projectError.message };

  // Assign members if selected
  if (memberIds.length > 0) {
    const memberRows = memberIds.map((userId) => ({
      project_id: project.id,
      user_id: userId,
    }));
    await supabase.from('project_members').insert(memberRows);
  }

  revalidatePath('/dashboard');
  return { success: true, projectId: project.id };
}

// 2. Edit Project
export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get('name') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const isArchived = formData.get('is_archived') === 'true';

  const { error } = await supabase
    .from('projects')
    .update({ name, description, is_archived: isArchived })
    .eq('id', projectId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { success: true };
}

// 3. Add Member to Project
export async function addProjectMember(projectId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// 4. Remove Member & Reassign Tasks (Uses the stored procedure created in Module 1)
export async function removeProjectMember(
  projectId: string,
  memberId: string,
  newAssigneeId?: string
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('remove_member_and_reassign_tasks', {
    p_project_id: projectId,
    p_member_id: memberId,
    p_new_assignee_id: newAssigneeId || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}