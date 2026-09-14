import Link from 'next/link';
import TaskTable from '@/components/TaskTable';
import {todayKey} from '@/lib/task-presentation';
export default function TasksPage(){return <div className="space-y-6"><h1 className="text-2xl font-bold">Workspace tasks</h1><p className="text-sm text-gray-500">Tasks in the active projects you can access.</p><Link className="inline-block rounded-lg border p-3" href="/dashboard/archive">View archived tasks</Link><TaskTable today={todayKey()}/></div>;}
