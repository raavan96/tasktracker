import {redirect} from 'next/navigation';
import Link from 'next/link';
import {currentUser} from '@/lib/postgres/auth';
import {transaction} from '@/lib/postgres/db';
import TaskAcknowledgement from '@/components/TaskAcknowledgement';
export default async function AcknowledgePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return <main className="p-8">Assignment unavailable.</main>;
 const user=await currentUser();if(!user)redirect('/login?next='+encodeURIComponent('/acknowledge/'+id));
 const row=await transaction(user.id,async db=>(await db.query('SELECT t.id,t.title,t.project_id,t.is_archived,t.status,p.is_archived project_archived FROM task_acknowledgements a JOIN tasks t ON t.id=a.task_id JOIN projects p ON p.id=t.project_id WHERE a.id=$1 AND a.user_id=$2',[id,user.id])).rows[0]);
 if(!row)return <main className="mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">Assignment unavailable</h1><p className="my-4">Sign in with the assigned account. The task may have been reassigned or removed.</p><Link href="/dashboard">Open workspace</Link></main>;
 return <main className="mx-auto max-w-xl p-6"><p className="mb-4">TaskTracker · Confirm receipt</p><h1 className="text-2xl font-semibold">{row.title}</h1><TaskAcknowledgement taskId={row.id} userId={user.id} readOnly={row.is_archived||row.project_archived||row.status==='done'}/><Link className="underline" href={`/dashboard/projects/${row.project_id}?task=${row.id}`}>Open task details →</Link></main>;
}
