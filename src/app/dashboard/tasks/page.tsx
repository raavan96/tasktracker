import WorkspaceHeading from '@/components/WorkspaceHeading';
import TaskOverview from '@/components/TaskOverview';
import Link from 'next/link';
import TaskTable from '@/components/TaskTable';
import {todayKey} from '@/lib/task-presentation';
export default async function TasksPage(){return <div className="space-y-6"><WorkspaceHeading className="text-2xl font-bold">Workspace tasks</WorkspaceHeading><p className="text-sm text-gray-500">Tasks in the active projects you can access.</p><Link className="inline-block rounded-lg border p-3" href="/dashboard/archive">View archived tasks</Link><TaskOverview/><TaskTable today={todayKey()}/></div>;}
