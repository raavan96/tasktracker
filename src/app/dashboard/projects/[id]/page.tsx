import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import ProjectView from './ProjectView';
import { todayKey } from '@/lib/task-presentation';
import type { Member } from '@/lib/task-types';

export default async function ProjectDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>; searchParams: Promise<{ task?: string; discussion?:string }>;
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
  const [membersResult, tasksResult, notesResult, usersResult, reviewResult] = await Promise.all([
    supabase.from('project_members')
      .select('user_id, joined_at, profiles(id, full_name, email, role, is_active)')
      .eq('project_id', id),
    supabase.from('tasks').select(`
      *,
      assignees:assigned_people(id,full_name,email,is_active), assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, is_active),
      task_comments(count)
    `).eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('project_notes')
      .select('*, author:profiles!project_notes_author_id_fkey(id, full_name, email, is_active)')
      .eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email, is_active').order('full_name'),
    supabase.from('review_settings').select('enabled').single(),
  ]);
  const { data: membersData } = membersResult;
  const { data: tasks } = tasksResult;
  const { data: notes } = notesResult;
  const { data: allUsers } = usersResult;
  if (usersResult.error) throw new Error('Creator information could not be loaded. Please retry.');
  const creators = new Map((allUsers || []).map(person => [person.id, person]));
  const projectMembers = membersData?.flatMap((row) => {
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Member | null;
    return profile ? [{ ...profile, joined_at: row.joined_at }] : [];
  }) || [];

  return (
    <ProjectView
      today={todayKey()} initialTaskId={(await searchParams).task || null} initialDiscussion={(await searchParams).discussion==='true'}
      project={{...project, creator: creators.get(project.created_by) || null}}
      tasks={(tasks || []).map(task => ({...task,comment_count:task.task_comments?.[0]?.count||0,task_comments:[], creator: creators.get(task.created_by) || null}))}
      notes={notes || []}
      members={projectMembers}
      allWorkspaceUsers={allUsers || []}
      currentUserId={user.id}
      isAdmin={isAdmin} reviewEnabled={reviewResult.data?.enabled===true}
    />
  );
}