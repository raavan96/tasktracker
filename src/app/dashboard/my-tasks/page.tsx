import {cookies} from 'next/headers';
import {getTaskPage} from '@/app/dashboard/discovery/actions';
import {taskRouteFilters,taskRequestKey} from '@/lib/task-route';
import WorkspaceHeading from '@/components/WorkspaceHeading';
import TaskOverview from '@/components/TaskOverview';
import TaskTable from '@/components/TaskTable';
import ActionCenter from '@/components/ActionCenter';
import { getActionCenterData } from '@/lib/action-center';
import { todayKey } from '@/lib/task-presentation';
import MyTasksHashScroll from './MyTasksHashScroll';

export default async function MyTasksPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const filters=taskRouteFilters(await searchParams,true);
  const [actionCenterData,initial]=await Promise.all([getActionCenterData(),getTaskPage(filters)]);
  const initialOpen=(await cookies()).get('tasktracker-focus-'+actionCenterData.userId)?.value==='true';

  return (
    <div className="space-y-6">
      <MyTasksHashScroll />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <WorkspaceHeading className="text-2xl font-bold">My Assigned Tasks</WorkspaceHeading>
          <p className="text-sm text-gray-500">Your assignments and work that needs your attention.</p>
        </div>
      </div>

      <section id="tasks" aria-label="My Assigned Tasks" className="space-y-6 scroll-mt-40">
        <TaskOverview mine />
        <TaskTable initialData={initial} initialKey={taskRequestKey(filters)} mine today={todayKey()} />
      </section>
      <section id="focus" aria-label="My Focus Area" className="scroll-mt-40">
        <ActionCenter data={actionCenterData} initialOpen={initialOpen} />
      </section>


    </div>
  );
}
