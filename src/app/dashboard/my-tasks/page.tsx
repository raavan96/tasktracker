import TaskOverview from '@/components/TaskOverview';
import TaskTable from '@/components/TaskTable';
import {todayKey} from '@/lib/task-presentation';
export default async function MyTasksPage(){return <div className="space-y-6"><h1 className="text-2xl font-bold">My Assigned Tasks</h1><p className="text-sm text-gray-500">Your assignments across active projects. Open a task to update its status or submit work for review.</p><TaskOverview mine/><TaskTable mine today={todayKey()}/></div>;}
