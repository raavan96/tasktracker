import {projectCollectionData} from '@/lib/project-collection';
import WorkspaceHeading from '@/components/WorkspaceHeading';
import OverviewCards from '@/components/OverviewCards';
import ProjectOverview from '@/components/ProjectOverview';
import Link from 'next/link';
import ProjectCollection from '@/components/ProjectCollection';
import TaskSummary from '@/components/TaskSummary';
import { todayKey } from '@/lib/task-presentation';
import CreateProjectModal from './CreateProjectModal';

export default async function DashboardPage({searchParams}:{searchParams:Promise<{archive?:string;status?:string}>}) {
  const query=await searchParams;
  const archived=query.archive==='true';
  const {projects,people:allUsers,userId,isAdmin}=await projectCollectionData();
  const activeProjects=projects.filter(p=>!p.is_archived);
  const needsAttention=(p:typeof projects[number])=>p.needs_attention;
  const readyToComplete=(p:typeof projects[number])=>p.ready;
  const taskCounts=Object.fromEntries(['overdue','today','in_progress','in_review','done'].map(key=>[key,activeProjects.reduce((total,p)=>total+Number(p[key as 'overdue']),0)]));
  const projectItems=[
   {id:'active',label:'Active projects',value:activeProjects.length,href:'/dashboard',hint:'View active projects'},
   {id:'overdue',label:'Needs attention',value:activeProjects.filter(needsAttention).length,href:'/dashboard?status=attention',hint:'Overdue or blocked tasks'},
   {id:'in_review',label:'Ready to complete',value:activeProjects.filter(readyToComplete).length,href:'/dashboard?status=ready',hint:'All tasks completed'},
   {id:'done',label:'Completed projects',value:(projects||[]).filter(p=>p.is_archived&&p.completed_at).length,href:'/dashboard/archive?section=completed',hint:'View completed projects'},
   {id:'archived',label:'Archived projects',value:(projects||[]).filter(p=>p.is_archived&&!p.completed_at).length,href:'/dashboard/archive',hint:'View general archive'},
  ];
  const creators = new Map((allUsers || []).map(person => [person.id, person]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <WorkspaceHeading className="text-2xl font-bold text-gray-900">Projects</WorkspaceHeading>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Manage workspace projects and team assignments' : 'Projects you are currently working on'}
          </p>
        </div>

        <CreateProjectModal users={(allUsers || []).filter(u=>u.is_active!==false)} />
      </div>

      <ProjectOverview userId={userId}>
      <section className="space-y-4"><div><h2 className="text-lg font-semibold">Project overview</h2><p className="mt-1 text-sm text-gray-500">Across projects you can access. Attention and ready-to-complete counts are subsets of active projects.</p></div><OverviewCards label="Project overview" items={projectItems}/></section>
      <h2 className="text-lg font-semibold">Task overview</h2>
      <TaskSummary counts={taskCounts} today={todayKey()} />
      </ProjectOverview>
      <nav className="flex gap-3" aria-label="Project visibility"><Link className="rounded-lg border px-4 py-2" aria-current={!archived?'page':undefined} href="/dashboard">Active projects</Link><Link className="rounded-lg border px-4 py-2" href="/dashboard/archive">Archived projects</Link></nav>
      <ProjectCollection projects={(projects||[]).filter(p=>p.is_archived===archived).map(p=>({id:p.id,name:p.name,description:p.description,created_at:p.created_at,last_task_edit_at:p.last_task_edit_at||undefined,creatorId:p.created_by,creator:creators.get(p.created_by)?.full_name||creators.get(p.created_by)?.email||'Unavailable',favorite:p.favorite,needsAttention:p.needs_attention,ready:p.ready,memberCount:p.member_count,totalTasks:p.total_tasks,completedTasks:p.completed_tasks}))}/>

    </div>
  );
}
