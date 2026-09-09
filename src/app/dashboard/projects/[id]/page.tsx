import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import ProjectView from './ProjectView';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  // Fetch Project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (!project) notFound();

  // Fetch Members
  const { data: membersData } = await supabase
    .from('project_members')
    .select('user_id, joined_at, profiles(id, full_name, email, role)')
    .eq('project_id', id);

  const projectMembers = membersData?.map((m: any) => ({
    id: m.profiles.id,
    full_name: m.profiles.full_name,
    email: m.profiles.email,
    role: m.profiles.role,
    joined_at: m.joined_at,
  })) || [];

  // Fetch Tasks with Assignee & Comments
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email),
      task_comments(*, author:profiles!task_comments_author_id_fkey(id, full_name, email))
    `)
    .eq('project_id', id)
    .order('created_at', { ascending: false });

  // Fetch Notes
  const { data: notes } = await supabase
    .from('project_notes')
    .select('*, author:profiles!project_notes_author_id_fkey(id, full_name, email)')
    .eq('project_id', id)
    .order('created_at', { ascending: false });

  // If Admin, get all workspace users to allow adding members
  const { data: allUsers } = isAdmin
    ? await supabase.from('profiles').select('id, full_name, email').order('full_name')
    : { data: [] };

  return (
    <ProjectView
      project={project}
      tasks={tasks || []}
      notes={notes || []}
      members={projectMembers}
      allWorkspaceUsers={allUsers || []}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  );
}