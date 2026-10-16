import WorkspaceHeading from '@/components/WorkspaceHeading';
import TaskOverview from '@/components/TaskOverview';
import TaskTable from '@/components/TaskTable';
import ActionCenter from '@/components/ActionCenter';
import { getActionCenterData } from '@/lib/action-center';
import { todayKey } from '@/lib/task-presentation';

export default async function MyTasksPage() {
  const actionCenterData = await getActionCenterData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <WorkspaceHeading className="text-2xl font-bold">My Assigned Tasks</WorkspaceHeading>
          <p className="text-sm text-gray-500">Your personal focus cockpit, daily action triage, and assignments across active projects.</p>
        </div>
      </div>

      <ActionCenter data={actionCenterData} />

      <TaskOverview mine />
      <TaskTable mine today={todayKey()} />
    </div>
  );
}
