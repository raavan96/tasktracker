import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import MyTasksClient from './MyTasksClient';

export default async function MyTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  // Fetch all tasks assigned to the current user across all projects
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      project:projects!tasks_project_id_fkey(id, name, is_archived),
      task_comments(count)
    `)
    .eq('assignee_id', user.id)
    .order('due_date', { ascending: true, nullsFirst: false });

  // Get list of distinct projects the user has tasks in
  const { data: userProjects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('is_archived', false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Assigned Tasks</h1>
        <p className="text-sm text-gray-500">Track and update all tasks assigned to you across your active projects.</p>
      </div>

      <MyTasksClient
        isAdmin={profile?.role === 'admin'} initialTasks={(tasks || []).filter(task => !task.project?.is_archived)}
        projects={userProjects || []}
      />
    </div>
  );
}
