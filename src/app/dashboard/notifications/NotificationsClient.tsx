'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useUrlState} from '@/lib/use-url-state';
import {setNotificationRead} from './actions';
type Notification={id:string;title:string;message:string;created_at:string;is_read:boolean;task?:{id:string;project_id:string}|null};
export default function NotificationsClient({notifications}:{notifications:Notification[]}){
 const [filter,setFilter]=useUrlState<string>('filter','all',{allowed:['all','unread']});
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function update(id:string|null,read:boolean){setBusy(true);setError('');try{const result=await setNotificationRead(id,read);if(result.error)setError(result.error);}catch{setError('Could not confirm the change. Please try again.');}finally{setBusy(false);}}
 const visible=notifications.filter(n=>filter!=='unread'||!n.is_read);
 return <div className="max-w-4xl mx-auto space-y-6"><div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-gray-500">Assignments, deadline reminders, and review updates.</p></div>
 <div className="flex flex-wrap gap-3"><select aria-label="Notification filter" className="rounded-lg border p-3" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All notifications</option><option value="unread">Unread ({notifications.filter(n=>!n.is_read).length})</option></select><button disabled={busy||!notifications.some(n=>!n.is_read)} className="rounded-lg border px-4 py-2 disabled:opacity-50" onClick={()=>update(null,true)}>Mark all as read</button></div>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
 <div aria-busy={busy} className="rounded-xl border bg-surface divide-y">{visible.map(n=><article key={n.id} className={`p-4 space-y-3 ${n.is_read?'':'bg-blue-50/40'}`}><h2 className="font-semibold">{n.title}{!n.is_read&&<span className="ml-2 text-xs text-blue-600">Unread</span>}</h2><p className="text-sm text-gray-600">{n.message}</p><p className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p><div className="flex flex-wrap gap-4 text-sm">{n.task?.project_id&&<Link className="text-blue-600 underline" href={`/dashboard/projects/${n.task.project_id}?task=${n.task.id}`}>Open task</Link>}<button disabled={busy} onClick={()=>update(n.id,!n.is_read)} className="text-blue-600 underline disabled:opacity-50">{n.is_read?'Mark as unread':'Mark as read'}</button></div></article>)}{!visible.length&&<p className="p-10 text-center text-gray-500">{filter==='unread'?'You’re all caught up.':'No notifications yet.'}</p>}</div></div>;
}
