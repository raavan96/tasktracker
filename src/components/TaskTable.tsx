'use client';
import {useEffect,useState,useRef} from 'react';
import {getTaskPage,exportTasks} from '@/app/dashboard/discovery/actions';
import { useUrlState } from '@/lib/use-url-state';
import Link from 'next/link';
import { deadlineLabel, initials, makeCsv, summaryFilters } from '@/lib/task-presentation';
export type TableTask = { assignee_id?: string|null; id: string; project_id: string; title: string; status: string; priority: string; due_date: string | null; assignee?: { is_active?: boolean; full_name: string | null; email: string } | null; creator?: { full_name: string | null; email: string } | null; project?: { name: string } | null };
export default function TaskTable({ today, onOpen, projectId, archived=false, mine=false }: { tasks?: TableTask[]; projectId?:string; archived?:boolean; mine?:boolean; today: string; onOpen?: (id: string) => void; initialSummary?: string }) {
  const [creatorColumn,setCreatorColumn]=useUrlState<string>('creator','off',{allowed:['off','on'],remember:'creator-column'});
  const showCreator=creatorColumn==='on';
  const [search,setSearch]=useUrlState<string>('q','',{replace:true});
  const [summary,setSummary]=useUrlState<string>('summary','all');
  const [assignee,setAssignee]=useUrlState<string>('assignee','all');
  const [sort,setSort]=useUrlState<string>('sort','deadline',{allowed:['deadline','title','priority','assignee']});
  const [priority,setPriority]=useUrlState<string>('priority','all');
  const [projectFilter,setProjectFilter]=useUrlState<string>('project','');
  const [legacyStatus]=useUrlState<string>('status','all');
  const [page,setPage]=useUrlState<string>('page','1');
  const [data,setData]=useState<Awaited<ReturnType<typeof getTaskPage>>|null>(null);
  const [busy,setBusy]=useState(true),[error,setError]=useState('');
  const key=JSON.stringify({q:search,summary,assignee,sort,project:projectId||projectFilter||undefined,priority,status:legacyStatus,archived,mine});const previous=useRef(key);
  useEffect(()=>{let active=true;if(previous.current!==key){previous.current=key;const url=new URL(window.location.href);url.searchParams.delete('page');window.history.replaceState(null,'',url.pathname+url.search);}
   const timer=setTimeout(()=>{setBusy(true);getTaskPage({...JSON.parse(key),page:Number(page)}).then(r=>{if(active){setData(r);setError(r.error);setBusy(false);}}).catch(()=>{if(active){setError('Task list could not load. Retry by refreshing.');setBusy(false);}});},180);return()=>{active=false;clearTimeout(timer);};},[key,page]);
  const people=new Map((data?.people||[]).map(p=>[p.id,p.full_name||p.email]));
  const filtered=data?.items||[];
  async function download() {setBusy(true);setError('');try{
    const result=await exportTasks(JSON.parse(key));if(result.error){setError(result.error);return;}
    const csv = makeCsv([['Task', 'Project', 'Assignee', ...(showCreator ? ['Created by'] : []), 'Status', 'Priority', 'Due date'], ...result.items.map(t => [t.title, t.project?.name, t.assignee?.full_name || t.assignee?.email, ...(showCreator ? [t.creator?.full_name || t.creator?.email || 'Unavailable'] : []), t.status, t.priority, t.due_date?.slice(0, 10)])]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'tasktracker-tasks.csv'; a.click(); URL.revokeObjectURL(url);
  }catch{setError('Export failed. Please retry.');}finally{setBusy(false);}}
  return <div className="task-table-view space-y-4">{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{busy&&<p role="status" className="text-sm text-gray-500">Loading tasks…</p>}
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
      <input aria-label="Search task table" placeholder="Search tasks, people, projects…" value={search} onChange={e => setSearch(e.target.value)} className="col-span-2 min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm" />
      <select aria-label="Task summary filter" value={summary} onChange={e => setSummary(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm"><option value="all">All tasks</option>{summaryFilters.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
      <select aria-label="Filter by assignee" value={assignee} onChange={e=>setAssignee(e.target.value)} className="min-w-0 rounded-lg border px-3 py-2.5 text-sm"><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{[...people].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=><option key={id} value={id}>{name}</option>)}{assignee!=='all'&&assignee!=='unassigned'&&!people.has(assignee)&&<option value={assignee}>Selected member — no tasks</option>}</select>
      <select aria-label="Filter by priority" value={priority} onChange={e=>setPriority(e.target.value)} className="min-w-0 rounded-lg border p-2.5 text-sm"><option value="all">All priorities</option>{['low','medium','high','urgent'].map(x=><option key={x}>{x}</option>)}</select>
      {!projectId&&<select aria-label="Filter by project" value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="min-w-0 rounded-lg border p-2.5 text-sm"><option value="">All projects</option>{data?.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      <select aria-label="Sort tasks" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm"><option value="deadline">Deadline</option><option value="priority">Priority</option><option value="title">Title</option><option value="assignee">Assignee</option></select>
      <button type="button" onClick={()=>{const url=new URL(window.location.href);['q','summary','assignee','sort','page','priority','project','status'].forEach(key=>url.searchParams.delete(key));window.history.pushState(null,'',url.pathname+url.search);}} className="rounded-lg border px-4 py-2.5 text-sm">Reset filters</button>
      <button type="button" disabled={busy} onClick={download} className="rounded-lg border px-4 py-2.5 text-sm">Export CSV</button>
    </div>
    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={showCreator} onChange={event => setCreatorColumn(event.target.checked?'on':'off')} />Show Created by column</label>
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{['Task', 'Assignee', ...(showCreator ? ['Created by'] : []), 'Status', 'Priority', 'Deadline'].map(h => <th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead>
        <tbody>{filtered.map(t => <tr key={t.id} className="border-t border-gray-200 hover:bg-gray-50">
          <td className="p-4 min-w-56">{onOpen ? <button onClick={() => onOpen(t.id)} className="text-left font-semibold text-blue-700">{t.title}</button> : <Link className="font-semibold text-blue-700" href={`/dashboard/projects/${t.project_id}?task=${t.id}`}>{t.title}</Link>}{t.project && <p className="mt-1 text-xs text-gray-500">{t.project.name}</p>}</td>
          <td className="p-4"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs text-blue-700">{initials(t.assignee?.full_name || t.assignee?.email || '?')}</span>{t.assignee?.full_name || t.assignee?.email || 'Unassigned'}{t.assignee?.is_active===false?' · Inactive':''}</td>
          {showCreator && <td className="p-4">{t.creator?.full_name || t.creator?.email || 'Unavailable'}</td>}
          <td className="p-4 capitalize whitespace-nowrap"><span className="task-status-label" data-status={t.status}>{t.status.replaceAll('_', ' ')}</span></td><td className="p-4 capitalize"><span className="task-priority-label" data-priority={t.priority}>{t.priority}</span></td><td className="p-4 whitespace-nowrap">{deadlineLabel(t.due_date, t.status, today)}</td>
        </tr>)}</tbody></table>
      {!busy&&!error&&!filtered.length && <p className="p-8 text-center text-gray-500">No matching tasks.</p>}
    </div>{(data?.total||0)>25&&<nav aria-label="Task pages" className="flex items-center gap-4 text-sm"><button disabled={busy||(data?.page||1)<=1} onClick={()=>setPage(String((data?.page||1)-1))} className="rounded-lg border p-3 disabled:opacity-40">Previous</button><span>Page {data?.page||1} of {Math.ceil((data?.total||0)/25)}</span><button disabled={busy||(data?.page||1)*25>=(data?.total||0)} onClick={()=>setPage(String((data?.page||1)+1))} className="rounded-lg border p-3 disabled:opacity-40">Next</button></nav>}<p className="text-xs text-gray-500">{data?.total||0} matching tasks · Showing {filtered.length} · Deadlines use India time · CSV opens in Excel</p>
  </div>;
}
