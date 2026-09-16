import OverviewCards from '@/components/OverviewCards';
import {assignedIds} from '@/lib/task-types';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayKey, matchesSummary } from '@/lib/task-presentation';
export default async function WorkloadPage() {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='admin')redirect('/dashboard');
  const [people,result]=await Promise.all([db.from('profiles').select('id,full_name,email,is_active').order('full_name'),db.from('tasks').select('assignee_id,assignee_ids,status,due_date,project:projects!inner(is_archived)').eq('project.is_archived',false).eq('is_archived',false)]);
  if(people.error||result.error)throw new Error('Workload report could not load.');
  const today=todayKey();const tasks=result.data||[];
  const overview=[
   {id:'pending',label:'Pending tasks',value:tasks.filter(t=>t.status!=='done').length,href:'/dashboard/tasks?summary=pending',hint:'All unfinished work'},
   {id:'overdue',label:'Overdue',value:tasks.filter(t=>matchesSummary(t,'overdue',today)).length,href:'/dashboard/tasks?summary=overdue',hint:'Review deadlines'},
   {id:'in_review',label:'Awaiting review',value:tasks.filter(t=>t.status==='in_review').length,href:'/dashboard/tasks?summary=in_review',hint:'View review queue'},
   {id:'done',label:'Completed',value:tasks.filter(t=>t.status==='done').length,href:'/dashboard/tasks?summary=done',hint:'Active-project tasks'},
   {id:'unassigned',label:'Unassigned pending',value:tasks.filter(t=>t.status!=='done'&&!assignedIds(t).length).length,href:'/dashboard/tasks?assignee=unassigned&summary=pending',hint:'Assign an owner'},
  ];
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Team workload</h1><p className="mt-1 text-sm text-gray-500">Task counts across active projects. Counts indicate volume, not effort.</p></div>
    <OverviewCards label="Workload overview" items={overview}/><p className="text-xs text-gray-500">Summary counts each task once. Shared tasks appear under every assignee in the table below.</p>
    <div className="overflow-x-auto rounded-xl border bg-surface"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr>{['Member','Pending','Overdue','In review','Completed'].map(t=><th key={t} className="p-4">{t}</th>)}</tr></thead><tbody>{[...(people.data || []),{id:null,full_name:'Unassigned',email:''}].map(p=>{const tasks=(result.data || []).filter(t=>p.id?assignedIds(t).includes(p.id):!assignedIds(t).length);return <tr key={p.id || 'unassigned'} className="border-t"><td className="p-4 font-medium">{p.full_name||p.email}{'is_active' in p&&p.is_active===false?' · Inactive':''}</td><td className="p-4"><Link className="inline-flex min-h-11 min-w-11 items-center text-blue-600 underline" href={`/dashboard/tasks?assignee=${p.id||'unassigned'}&summary=pending`} aria-label={`${p.full_name||p.email}: pending tasks`}>{tasks.filter(t=>t.status!=='done').length}</Link></td><td className="p-4"><Link className="inline-flex min-h-11 min-w-11 items-center text-blue-600 underline" href={`/dashboard/tasks?assignee=${p.id||'unassigned'}&summary=overdue`} aria-label={`${p.full_name||p.email}: overdue tasks`}>{tasks.filter(t=>matchesSummary(t,'overdue',today)).length}</Link></td><td className="p-4"><Link className="inline-flex min-h-11 min-w-11 items-center text-blue-600 underline" href={`/dashboard/tasks?assignee=${p.id||'unassigned'}&summary=in_review`} aria-label={`${p.full_name||p.email}: in review tasks`}>{tasks.filter(t=>t.status==='in_review').length}</Link></td><td className="p-4"><Link className="inline-flex min-h-11 min-w-11 items-center text-blue-600 underline" href={`/dashboard/tasks?assignee=${p.id||'unassigned'}&summary=done`} aria-label={`${p.full_name||p.email}: done tasks`}>{tasks.filter(t=>t.status==='done').length}</Link></td></tr>;})}</tbody></table></div>
  </div>;
}
