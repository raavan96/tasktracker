import {projectTasks,projectNotes,projectCounts} from '../data';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import ProjectView from './ProjectView';
import { todayKey } from '@/lib/task-presentation';
import type { Member } from '@/lib/task-types';

export default async function ProjectDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>; searchParams: Promise<{ task?: string; discussion?:string;view?:string;tab?:string }>;
}) {
  const { id } = await params;
  const search=await searchParams;
  const tasksLoaded=search.view!=='table'&&(!search.tab||search.tab==='tasks');
  const notesLoaded=search.tab==='notes';
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
  const [membersResult, tasks, notes, usersResult, reviewResult, counts] = await Promise.all([
    supabase.from('project_members')
      .select('user_id, joined_at, profiles(id, full_name, email, role, is_active)')
      .eq('project_id', id),
    tasksLoaded?projectTasks(id,project.is_archived):search.task?projectTasks(id,true,search.task):Promise.resolve([]),
    notesLoaded?projectNotes(id):Promise.resolve([]),
    supabase.from('profiles').select('id, full_name, email, is_active').order('full_name'),
    supabase.from('review_settings').select('enabled').single(),
    projectCounts(id),
  ]);
  if ([membersResult,usersResult,reviewResult].some(result=>result.error)) throw new Error('Project data could not be loaded. Please retry.');
  const { data: membersData } = membersResult;
  const { data: allUsers } = usersResult;
  if (usersResult.error) throw new Error('Creator information could not be loaded. Please retry.');
  const creators = new Map((allUsers || []).map(person => [person.id, person]));
  const projectMembers = membersData?.flatMap((row) => {
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Member | null;
    return profile ? [{ ...profile, joined_at: row.joined_at }] : [];
  }) || [];

  return (
    <ProjectView
      counts={counts} tasksLoaded={tasksLoaded} notesLoaded={notesLoaded}
      today={todayKey()} initialTaskId={(await searchParams).task || null} initialDiscussion={(await searchParams).discussion==='true'}
      project={{...project, creator: creators.get(project.created_by) || null}}
      tasks={tasks}
      notes={notes || []}
      members={projectMembers}
      allWorkspaceUsers={allUsers || []}
      currentUserId={user.id}
      isAdmin={isAdmin} reviewEnabled={reviewResult.data?.enabled===true}
    />
  );
}