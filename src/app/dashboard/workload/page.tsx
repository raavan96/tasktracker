import WorkspaceHeading from '@/components/WorkspaceHeading';
import OverviewCards from '@/components/OverviewCards';
import {assignedIds} from '@/lib/task-types';
import WorkloadView from './WorkloadView';
import {workloadModel} from '@/lib/workload';
import type {WorkloadTask} from '@/lib/workload';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayKey, matchesSummary } from '@/lib/task-presentation';
export default async function WorkloadPage() {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='admin')redirect('/dashboard');
  const [people,result]=await Promise.all([db.from('profiles').select('id,full_name,email,is_active').order('full_name'),db.from('tasks').select('id,project_id,title,assignee_id,assignee_ids,status,due_date,project:projects!inner(name,is_archived)').eq('project.is_archived',false).eq('is_archived',false)]);
  if(people.error||result.error)throw new Error('Workload report could not load.');
  const today=todayKey();const tasks=result.data||[];
  const overview=[
   {id:'pending',label:'Pending tasks',value:tasks.filter(t=>t.status!=='done').length,href:'/dashboard/tasks?summary=pending',hint:'All unfinished work'},
   {id:'overdue',label:'Overdue',value:tasks.filter(t=>matchesSummary(t,'overdue',today)).length,href:'/dashboard/tasks?summary=overdue',hint:'Review deadlines'},
   {id:'in_review',label:'Awaiting review',value:tasks.filter(t=>t.status==='in_review').length,href:'/dashboard/tasks?summary=in_review',hint:'View review queue'},
   {id:'done',label:'Completed',value:tasks.filter(t=>t.status==='done').length,href:'/dashboard/tasks?summary=done',hint:'Active-project tasks'},
   {id:'unassigned',label:'Unassigned pending',value:tasks.filter(t=>t.status!=='done'&&!assignedIds(t).length).length,href:'/dashboard/tasks?assignee=unassigned&summary=pending',hint:'Assign an owner'},
  ];
  return <div className="space-y-6"><div><WorkspaceHeading className="text-2xl font-bold">Team workload</WorkspaceHeading><p className="mt-1 text-sm text-gray-500">Task counts across active projects. Counts indicate volume, not effort.</p></div>
    <OverviewCards label="Workload overview" items={overview}/>
    <WorkloadView model={workloadModel(people.data||[],tasks as unknown as WorkloadTask[],today)} today={today}/>
  </div>;
}
