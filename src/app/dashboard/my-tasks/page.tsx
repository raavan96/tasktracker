import WorkspaceHeading from '@/components/WorkspaceHeading';
import TaskOverview from '@/components/TaskOverview';
import TaskTable from '@/components/TaskTable';
import ActionCenter from '@/components/ActionCenter';
import { getActionCenterData } from '@/lib/action-center';
import { todayKey } from '@/lib/task-presentation';
import MyTasksHashScroll from './MyTasksHashScroll';

export default async function MyTasksPage() {
  const actionCenterData = await getActionCenterData();

  return (
    <div className="space-y-6">
      <MyTasksHashScroll />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <WorkspaceHeading className="text-2xl font-bold">My Assigned Tasks</WorkspaceHeading>
          <p className="text-sm text-gray-500">Your personal focus cockpit, daily action triage, and assignments across active projects.</p>
        </div>
      </div>

      <section id="focus" aria-label="My Focus Area" className="scroll-mt-20">
        <ActionCenter data={actionCenterData} />
      </section>

      <section id="tasks" aria-label="My Assigned Tasks" className="space-y-6 scroll-mt-20">
        <TaskOverview mine />
        <TaskTable mine today={todayKey()} />
      </section>
    </div>
  );
}
