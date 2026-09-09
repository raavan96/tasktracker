import { createClient } from '@/lib/supabase/server';

// Server Actions are public endpoints: keep authorization alongside each write.
export async function projectAccess(projectId: string, adminOnly = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' } as const;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';
  if (adminOnly && !isAdmin) return { error: 'Only admins can manage project membership.' } as const;
  const { data: project } = await supabase.from('projects').select('id, is_archived').eq('id', projectId).single();
  if (!project) return { error: 'Project not found or access denied.' } as const;
  if (project.is_archived) return { error: 'This project is archived.' } as const;
  if (!isAdmin) {
    const { data: member } = await supabase.from('project_members').select('user_id').eq('project_id', projectId).eq('user_id', user.id).maybeSingle();
    if (!member) return { error: 'You must belong to this project to make changes.' } as const;
  }
  return { supabase, user, isAdmin } as const;
}

export async function checkAssignee(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, assigneeId: string | null) {
  if (!assigneeId) return null;
  const { data, error } = await supabase.from('project_members').select('user_id').eq('project_id', projectId).eq('user_id', assigneeId).maybeSingle();
  return error || !data ? 'Add this teammate to the project before assigning tasks to them.' : null;
}
