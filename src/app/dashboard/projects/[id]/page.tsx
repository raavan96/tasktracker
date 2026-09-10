import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import ProjectView from './ProjectView';
import { todayKey } from '@/lib/task-presentation';
import type { Member } from '@/lib/task-types';

export default async function ProjectDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>; searchParams: Promise<{ task?: string }>;
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

  // Independent reads start together after authentication and project visibility checks.
  const [membersResult, tasksResult, notesResult, usersResult] = await Promise.all([
    supabase.from('project_members')
      .select('user_id, joined_at, profiles(id, full_name, email, role)')
      .eq('project_id', id),
    supabase.from('tasks').select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email),
      task_comments(*, author:profiles!task_comments_author_id_fkey(id, full_name, email))
    `).eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('project_notes')
      .select('*, author:profiles!project_notes_author_id_fkey(id, full_name, email)')
      .eq('project_id', id).order('created_at', { ascending: false }),
    (isAdmin || project.created_by === user.id)
      ? supabase.from('profiles').select('id, full_name, email').order('full_name')
      : Promise.resolve({ data: [] }),
  ]);
  const { data: membersData } = membersResult;
  const { data: tasks } = tasksResult;
  const { data: notes } = notesResult;
  const { data: allUsers } = usersResult;
  const projectMembers = membersData?.flatMap((row) => {
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Member | null;
    return profile ? [{ ...profile, joined_at: row.joined_at }] : [];
  }) || [];

  return (
    <ProjectView
      today={todayKey()} initialTaskId={(await searchParams).task || null}
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