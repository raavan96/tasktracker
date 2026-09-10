import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayKey, matchesSummary } from '@/lib/task-presentation';
export default async function WorkloadPage() {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='admin')redirect('/dashboard');
  const [people,result]=await Promise.all([db.from('profiles').select('id,full_name,email').order('full_name'),db.from('tasks').select('assignee_id,status,due_date,project:projects!inner(is_archived)').eq('project.is_archived',false)]);
  if(people.error||result.error)throw new Error('Workload report could not load.');
  const today=todayKey();
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Team workload</h1><p className="mt-1 text-sm text-gray-500">Task counts across active projects. Counts indicate volume, not effort.</p></div>
    <div className="overflow-x-auto rounded-xl border bg-surface"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr>{['Member','Pending','Overdue','In review','Completed'].map(t=><th key={t} className="p-4">{t}</th>)}</tr></thead><tbody>{[...(people.data || []),{id:null,full_name:'Unassigned',email:''}].map(p=>{const tasks=(result.data || []).filter(t=>t.assignee_id===p.id);return <tr key={p.id || 'unassigned'} className="border-t"><td className="p-4 font-medium">{p.full_name||p.email}</td><td className="p-4">{tasks.filter(t=>t.status!=='done').length}</td><td className="p-4">{tasks.filter(t=>matchesSummary(t,'overdue',today)).length}</td><td className="p-4">{tasks.filter(t=>t.status==='in_review').length}</td><td className="p-4">{tasks.filter(t=>t.status==='done').length}</td></tr>;})}</tbody></table></div>
  </div>;
}
