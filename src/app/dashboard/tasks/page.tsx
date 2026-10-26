import WorkspaceHeading from '@/components/WorkspaceHeading';
import TaskOverview from '@/components/TaskOverview';
import Link from 'next/link';
import TaskTable from '@/components/TaskTable';
import {getTaskPage} from '@/app/dashboard/discovery/actions';
import {taskRouteFilters,taskRequestKey} from '@/lib/task-route';
import {todayKey} from '@/lib/task-presentation';
export default async function TasksPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const filters=taskRouteFilters(await searchParams);const initial=await getTaskPage(filters);return <div className="space-y-6"><WorkspaceHeading className="text-2xl font-bold">All Tasks</WorkspaceHeading><p className="text-sm text-gray-500">Tasks in the active projects you can access.</p><Link className="inline-block rounded-lg border p-3" href="/dashboard/archive">View archived tasks</Link><TaskOverview/><TaskTable initialData={initial} initialKey={taskRequestKey(filters)} today={todayKey()}/></div>;}
