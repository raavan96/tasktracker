'use server';

import { revalidatePath } from 'next/cache';
import { projectAccess } from '@/lib/project-access';
import { createClient } from '@/lib/supabase/server';

export async function deleteProject(projectId: string, confirmationName: string) {
  const access = await projectAccess(projectId, true, true);
  if (access.error) return { error: access.error };
  const { data: project, error: lookupError } = await access.supabase.from('projects').select('name').eq('id', projectId).single();
  if (lookupError || !project) return { error: 'Project not found or access denied.' };
  if (confirmationName !== project.name) return { error: 'The project name does not match. Check it and try again.' };
  // A single DELETE is atomic. Existing FK cascades handle linked records;
  // restrictive foreign keys abort the deletion instead of leaving a partial project.
  const { data, error } = await access.supabase.from('projects').delete().eq('id', projectId).select('id').single();
  if (error || !data) return { error: error?.code === '23503' ? 'Linked records prevented deletion. Your administrator needs to check the project’s database delete rules.' : error?.message || 'The project could not be deleted. Refresh and try again.' };
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/my-tasks');
  revalidatePath('/dashboard/notifications');
  return { success: true };
}

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
  const access = await projectAccess(projectId, true);
  if (access.error) return { error: access.error };
  const supabase = access.supabase;
  if (!userId) return { error: 'Choose a teammate first.' };
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).single();
  if (!profile) return { error: 'This teammate is not in the workspace. Invite them from Team Users first.' };
  const { error } = await supabase.from('project_members').insert({ project_id: projectId, user_id: userId });
  if (error && error.code !== '23505') return { error: error.message };
  revalidatePath('/dashboard');

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

// 4. Remove Member & Reassign Tasks (Uses the stored procedure created in Module 1)
export async function removeProjectMember(
  projectId: string,
  memberId: string,
  newAssigneeId?: string
) {
  const access = await projectAccess(projectId, true);
  if (access.error) return { error: access.error };
  const supabase = access.supabase;

  const { error } = await supabase.rpc('remove_member_and_reassign_tasks', {
    p_project_id: projectId,
    p_member_id: memberId,
    p_new_assignee_id: newAssigneeId || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}
