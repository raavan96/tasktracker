'use client';
import { useEffect, useState, useCallback } from 'react';
import { getTaskExtras, saveChecklist, setDependency, uploadAttachment, attachmentLink } from '@/app/dashboard/tasks/extras';
import type { Task, Member } from '@/lib/task-types';
export default function TaskExtras({ task, tasks, members, canEdit }: { task:Task; tasks:Task[]; members:Member[]; canEdit:boolean }) {
  const [data,setData]=useState<Awaited<ReturnType<typeof getTaskExtras>> | null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const result=await getTaskExtras(task.id,task.project_id);setData(result);},[task.id,task.project_id]);
  useEffect(()=>{let active=true; getTaskExtras(task.id,task.project_id).then(result=>{if(active)setData(result);}).catch(()=>{if(active)setError('Task details could not load.');});return()=>{active=false};},[task.id,task.project_id,task.status]);
  async function run(action:()=>Promise<{error?:string}>) {setBusy(true);setError('');try{const result=await action();if(result.error)setError(result.error);else await load();}catch{setError('Could not save. Please retry.');}finally{setBusy(false);}}
  function value(field:string,text:string|null){if(!text)return 'None';if(field==='assignee_id')return members.find(m=>m.id===text)?.full_name || members.find(m=>m.id===text)?.email || 'Former member';return text.replaceAll('_',' ');}
  if(!data&&error)return <p role="alert" className="py-4 text-sm text-red-700">{error}</p>;
  if(!data)return <p role="status" className="py-4 text-sm text-gray-500">Loading checklist and history…</p>;
  if(data.error)return <p role="alert" className="py-4 text-sm text-red-700">{data.error}</p>;
  return <div className="space-y-6 border-t py-5">
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section><h3 className="mb-3 font-semibold">Checklist <span className="text-sm text-gray-500">{data.checklist?.filter(c=>c.completed).length}/{data.checklist?.length}</span></h3>
      {data.checklist?.map(c=><label key={c.id} className="flex gap-3 items-center py-2 text-sm"><input type="checkbox" checked={c.completed} disabled={busy||!canEdit||task.status==='done'} onChange={e=>run(()=>saveChecklist(task.id,task.project_id,'',c.id,e.target.checked))}/><span className={c.completed?'line-through text-gray-500':''}>{c.title}</span></label>)}
      {canEdit&&task.status!=='done'&&<form className="flex gap-2 mt-2" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;await run(()=>saveChecklist(task.id,task.project_id,String(new FormData(form).get('title')||'')));}}><input name="title" aria-label="Checklist item" required maxLength={300} placeholder="Add a checklist item" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/><button disabled={busy} className="rounded-lg border px-3 text-sm">Add</button></form>}
    </section>
    <section><h3 className="mb-3 font-semibold">Waiting on</h3>{!data.dependencies?.length&&<p className="text-sm text-gray-500">No dependencies.</p>}
      {data.dependencies?.map(d=><div key={d.depends_on} className="flex justify-between gap-3 py-2 text-sm"><span>{tasks.find(t=>t.id===d.depends_on)?.title || 'Task'} · {tasks.find(t=>t.id===d.depends_on)?.status.replaceAll('_',' ')}</span>{canEdit&&<button disabled={busy} onClick={()=>run(()=>setDependency(task.id,task.project_id,d.depends_on,true))}>Remove link</button>}</div>)}
      {canEdit&&task.status!=='done'&&<form className="flex gap-2 mt-2" onSubmit={e=>{e.preventDefault();const id=String(new FormData(e.currentTarget).get('dependency'));void run(()=>setDependency(task.id,task.project_id,id));}}><select name="dependency" aria-label="Dependency task" required className="min-w-0 flex-1 rounded-lg border p-2 text-sm"><option value="">Choose prerequisite</option>{tasks.filter(t=>t.id!==task.id&&!data.dependencies?.some(d=>d.depends_on===t.id)).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><button disabled={busy} className="rounded-lg border px-3 text-sm">Add</button></form>}
    </section>
    <section><h3 className="mb-3 font-semibold">Attachments</h3>{data.attachments?.map(a=><button key={a.id} className="block py-2 text-left text-sm text-blue-700 underline break-all" onClick={()=>run(async()=>{const result=await attachmentLink(a.id);if(result.error)return {error:result.error};if(result.url)window.location.assign(result.url);return {};})}>{a.name} · {Math.ceil(a.size/1024)} KB</button>)}
      {canEdit&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void run(()=>uploadAttachment(task.id,task.project_id,form));}}><input type="file" name="file" required aria-label="Task attachment" className="w-full text-sm"/><p className="text-xs text-gray-500">Up to 10 MB. Visible only to people with project access.</p><button disabled={busy} className="rounded-lg border px-3 py-2 text-sm">Upload file</button></form>}
    </section>
    <section><h3 className="mb-3 font-semibold">Task history</h3><p className="mb-2 text-xs text-gray-500">Latest 100 changes. History starts when this feature is enabled.</p>{data.history?.map(h=><div key={h.id} className="border-l-2 border-gray-200 pl-3 py-2 text-sm"><p className="font-medium">{h.field.replaceAll('_',' ')}: {h.field==='created'?'':`${value(h.field,h.old_value)} → `}{value(h.field,h.new_value)}</p><p className="mt-1 text-xs text-gray-500">{h.actor?.full_name || h.actor?.email || 'System'} · {new Date(h.created_at).toLocaleString()}</p></div>)}</section>
  </div>;
}
