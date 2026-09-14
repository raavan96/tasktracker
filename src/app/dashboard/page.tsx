import {assignedIds} from '@/lib/task-types';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import ProjectCollection from '@/components/ProjectCollection';
import TaskSummary from '@/components/TaskSummary';
import { todayKey, matchesSummary, deadlineLabel } from '@/lib/task-presentation';
import CreateProjectModal from './CreateProjectModal';

export default async function DashboardPage({searchParams}:{searchParams:Promise<{archive?:string}>}) {
  const archived=(await searchParams).archive==='true';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  const [{ data: projects, error: projectsError }, { data: allUsers, error: usersError },{data:reviewPolicy}] = await Promise.all([
    supabase.from('projects').select(`
      id, name, description, is_archived, created_at, created_by,
      project_members(count), tasks(id, title, created_by, assignee_id,assignee_ids, status, due_date, is_archived)
    `).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email, is_active').order('full_name'),
    supabase.from('review_settings').select('enabled').single(),
  ]);

  if(projectsError||usersError)throw new Error('The workspace could not load. Please retry.');
  const today=todayKey();
  const attention=(projects||[]).filter(p=>!p.is_archived).flatMap(p=>(p.tasks||[]).filter(t=>!t.is_archived).map(t=>({...t,projectId:p.id,projectName:p.name}))).filter(t=>((isAdmin||(reviewPolicy?.enabled&&t.created_by===user?.id))&&!assignedIds(t).includes(user?.id||'')&&t.status==='in_review')||(assignedIds(t).includes(user?.id||'')&&['overdue','today','blocked'].some(f=>matchesSummary(t,f,today)))).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  const creators = new Map((allUsers || []).map(person => [person.id, person]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Manage workspace projects and team assignments' : 'Projects you are currently working on'}
          </p>
        </div>

        <CreateProjectModal users={(allUsers || []).filter(u=>u.is_active!==false)} />
      </div>

      <TaskSummary tasks={(projects || []).filter(p => !p.is_archived).flatMap(p => (p.tasks || []).filter(t=>!t.is_archived))} today={todayKey()} />
      <section aria-label="Needs my attention" className="rounded-xl border bg-surface p-5"><h2 className="text-lg font-semibold">Needs my attention</h2><p className="mt-1 text-sm text-gray-500">Your overdue, due today and blocked tasks{', plus work you can review'}.</p><div className="mt-4 divide-y">{attention.slice(0,8).map(task=><Link key={task.id} href={`/dashboard/projects/${task.projectId}?task=${task.id}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span><strong>{task.title}</strong><span className="block text-gray-500">{task.projectName}</span></span><span className="text-blue-600">{task.status==='in_review'?'Awaiting review':task.status==='blocked'?'Blocked':deadlineLabel(task.due_date,task.status,today)}</span></Link>)}{!attention.length&&<p className="py-3 text-sm text-gray-500">No urgent actions right now.</p>}</div>{attention.length>8&&<Link className="text-sm text-blue-600 underline" href="/dashboard/tasks">Review all tasks</Link>}</section>
      <nav className="flex gap-3" aria-label="Project visibility"><Link className="rounded-lg border px-4 py-2" aria-current={!archived?'page':undefined} href="/dashboard">Active projects</Link><Link className="rounded-lg border px-4 py-2" href="/dashboard/archive">Archived projects</Link></nav>
      <ProjectCollection projects={(projects||[]).filter(p=>p.is_archived===archived).map(p=>({id:p.id,name:p.name,description:p.description,created_at:p.created_at,creator:creators.get(p.created_by)?.full_name||creators.get(p.created_by)?.email||'Unavailable',memberCount:p.project_members?.[0]?.count||0,totalTasks:p.tasks?.length||0,completedTasks:p.tasks?.filter(t=>t.status==='done').length||0}))}/>
    </div>
  );
}
