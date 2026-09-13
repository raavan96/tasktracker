import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import TaskTable from '@/components/TaskTable';
import { todayKey } from '@/lib/task-presentation';
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ summary?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data, error }, people] = await Promise.all([supabase.from('tasks').select('id, project_id, created_by, title, status, priority, due_date, assignee:profiles!tasks_assignee_id_fkey(full_name,email), project:projects!inner(name,is_archived)').eq('project.is_archived', false).eq('is_archived',false).order('due_date', { nullsFirst: false }), supabase.from('profiles').select('id,full_name,email')]);
  const creators = new Map((people.data || []).map(person => [person.id, person]));
  if (error || people.error) throw new Error('Task list could not be loaded. Please retry.');
  const tasks = (data || []).map(t => ({ ...t, creator: creators.get(t.created_by) || null, assignee: Array.isArray(t.assignee) ? t.assignee[0] : t.assignee, project: Array.isArray(t.project) ? t.project[0] : t.project }));
  const filter = (await searchParams).summary || 'all';
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Workspace tasks</h1><p className="mt-1 text-sm text-gray-500">Tasks in the active projects you can access.</p></div><Link className="inline-block rounded-lg border px-4 py-2" href="/dashboard/archive">View archived tasks</Link><TaskTable key={filter} tasks={tasks} today={todayKey()} initialSummary={filter} /></div>;
}
