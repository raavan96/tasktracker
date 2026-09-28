'use client';
import {useEffect,useState,useRef,useId} from 'react';
import {SlidersHorizontal, X, Download, Columns3} from 'lucide-react';
import {getTaskPage,exportTasks} from '@/app/dashboard/discovery/actions';
import { useUrlState } from '@/lib/use-url-state';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import SavedTaskViews from './SavedTaskViews';
import BulkTaskActions from './BulkTaskActions';
import {activityLabel,activeTaskFilterChips,clearTaskFilterParams} from '@/lib/task-views';
import {assigneeNames} from '@/lib/task-types';
import { deadlineLabel, initials, makeCsv, summaryFilters } from '@/lib/task-presentation';
export type TableTask = {last_activity?:string;can_manage?:boolean;review_version?:number; assignee_ids?:string[];assignees?:import('@/lib/task-types').Member[];assignee_id?: string|null; id: string; project_id: string; title: string; status: string; priority: string; due_date: string | null; assignee?: { is_active?: boolean; full_name: string | null; email: string } | null; creator?: { full_name: string | null; email: string } | null; project?: { name: string } | null };
export default function TaskTable({ today, onOpen, projectId, archived=false, mine=false, refreshToken }: { refreshToken?:unknown; tasks?: TableTask[]; projectId?:string; archived?:boolean; mine?:boolean; today: string; onOpen?: (id: string) => void; initialSummary?: string }) {
  const router=useRouter();
  const [filtersOpen,setFiltersOpen]=useState(false),[columnsOpen,setColumnsOpen]=useState(false);
  const filtersId=useId(),columnsId=useId();
  const [mobileView,setMobileView]=useUrlState<string>('taskLayout','rows',{allowed:['rows','table'],remember:'mobile-task-layout'});
  const [selectionMode,setSelectionMode]=useState(false);
  const [creatorColumn,setCreatorColumn]=useUrlState<string>('creator','off',{allowed:['off','on'],remember:'creator-column'});
  const showCreator=creatorColumn==='on';
  const [search,setSearch]=useUrlState<string>('q','',{replace:true});
  const [summary,setSummary]=useUrlState<string>('summary','all');
  const [assignee,setAssignee]=useUrlState<string>('assignee','all');
  const [sort,setSort]=useUrlState<string>('sort','deadline',{allowed:['deadline','title','priority','assignee']});
  const [priority,setPriority]=useUrlState<string>('priority','all');
  const [projectFilter,setProjectFilter]=useUrlState<string>('project','');
  const [preset]=useUrlState<string>('preset','all',{allowed:['all','delegated','review','stale']});
  const [savedMine]=useUrlState<string>('mine','false',{allowed:['true','false']});
  const [selection,setSelection]=useState<{key:string;ids:string[]}>({key:'',ids:[]});
  const [legacyStatus]=useUrlState<string>('status','all');
  const [page,setPage]=useUrlState<string>('page','1');
  const optionsLoaded=useRef(false);const [focusVersion,setFocusVersion]=useState(0);
  useEffect(()=>{const refresh=()=>{optionsLoaded.current=false;setFocusVersion(n=>n+1);};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
  const [data,setData]=useState<Awaited<ReturnType<typeof getTaskPage>>|null>(null);
  const [busy,setBusy]=useState(true),[error,setError]=useState('');
  const [debouncedSearch,setDebouncedSearch]=useState(search);
  useEffect(()=>{const timer=setTimeout(()=>setDebouncedSearch(search),180);return()=>clearTimeout(timer);},[search]);
  const key=JSON.stringify({q:debouncedSearch,summary,assignee,sort,project:projectId||projectFilter||undefined,priority,status:legacyStatus,archived,mine:mine||savedMine==='true',preset});const previous=useRef(key);
  useEffect(()=>{let active=true;const changed=previous.current!==key;
   if(changed){previous.current=key;if(page!=='1'){const url=new URL(window.location.href);url.searchParams.delete('page');window.history.replaceState(null,'',url.pathname+url.search);return;}}
   const includeOptions=!optionsLoaded.current;setBusy(true);getTaskPage({...JSON.parse(key),page:Number(page),includeOptions}).then(r=>{if(active){if(r.error)setError(r.error);else{setData(previous=>!includeOptions&&previous?{...r,people:previous.people,projects:previous.projects,views:previous.views}:r);optionsLoaded.current=true;setError('');}setBusy(false);}}).catch(()=>{if(active){setError('Task list could not load. Retry by refreshing.');setBusy(false);}});
   return()=>{active=false;};},[key,page,focusVersion,refreshToken]);
  const people=new Map((data?.people||[]).map(p=>[p.id,p.full_name||p.email]));
  const filtered=data?.items||[];
  const selectionKey=key+':'+page;const selected=selection.key===selectionKey?selection.ids:[];
  const selectedRows=filtered.filter(t=>selected.includes(t.id)&&t.can_manage);
  const eligible=filtered.filter(t=>t.can_manage);
  function quickView(value:string){if(mine&&['review','delegated'].includes(value)){router.push('/dashboard/tasks?preset='+value);return;}const url=new URL(window.location.href);['summary','status','page'].forEach(k=>url.searchParams.delete(k));if(['review','delegated'].includes(value))url.searchParams.delete('mine');url.searchParams.set('preset',value);window.history.pushState(null,'',url.pathname+url.search);}
  const myScope=mine||savedMine==='true';
  const chips=activeTaskFilterChips({q:search,summary,assignee,priority,project:projectFilter,status:legacyStatus,preset,mine:String(myScope)},{mine,projectId,people:Object.fromEntries(people),projects:Object.fromEntries((data?.projects||[]).map(p=>[p.id,p.name]))});
  function removeFilter(name:string){const url=new URL(window.location.href);url.searchParams.delete(name);url.searchParams.delete('page');window.history.pushState(null,'',url.pathname+url.search+url.hash);setSelection({key:'',ids:[]});}
  function resetFilters(){const url=new URL(window.location.href);url.search=clearTaskFilterParams(url.searchParams).toString();window.history.pushState(null,'',url.pathname+url.search+url.hash);setSelection({key:'',ids:[]});setSelectionMode(false);}

  async function download() {setBusy(true);setError('');try{
    const result=await exportTasks(JSON.parse(key));if(result.error){setError(result.error);return;}
    const csv = makeCsv([['Task', 'Project', 'Assignee', ...(showCreator ? ['Created by'] : []), 'Status', 'Priority', 'Due date'], ...result.items.map(t => [t.title, t.project?.name, assigneeNames(t), ...(showCreator ? [t.creator?.full_name || t.creator?.email || 'Unavailable'] : []), t.status, t.priority, t.due_date?.slice(0, 10)])]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'tasktracker-tasks.csv'; a.click(); URL.revokeObjectURL(url);
  }catch{setError('Export failed. Please retry.');}finally{setBusy(false);}}
  return <div className="task-table-view space-y-4" data-mobile-view={mobileView} data-selecting={selectionMode||selected.length>0}>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{busy&&<p role="status" className="text-sm text-gray-500">Loading tasks…</p>}
    <div className="task-primary-toolbar flex items-center gap-2">
      <input aria-label="Search task table" maxLength={200} placeholder="Search tasks, people, projects…" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm"/>
      <button type="button" aria-expanded={filtersOpen} aria-controls={filtersId} onClick={()=>setFiltersOpen(!filtersOpen)} className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"><SlidersHorizontal size={16} aria-hidden="true"/>Filters{chips.length>0?` (${chips.length})`:''}</button>
    </div>
    <div aria-label="Current task scope" className="space-y-2 text-sm">
      <p className="text-xs text-gray-500">{archived?'Archived tasks':mine?'My assignments · active projects':projectId?'Tasks in this project':'Tasks across accessible active projects'}</p>
      {chips.length>0&&<div className="flex flex-wrap items-center gap-2" aria-label="Active task filters">{chips.map(chip=><button key={chip.key} type="button" aria-label={`Remove filter: ${chip.label}`} onClick={()=>removeFilter(chip.key)} className="task-filter-chip inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs"><span className="min-w-0 break-words">{chip.label}</span><X size={14} className="shrink-0" aria-hidden="true"/></button>)}<button type="button" onClick={resetFilters} className="rounded-lg px-2 py-1.5 text-xs underline">Clear all filters</button></div>}
    </div>
    <section id={filtersId} hidden={!filtersOpen} aria-label="Task filters" className="space-y-4 rounded-xl border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs">View<select aria-label="Task view scope" value={preset} onChange={e=>quickView(e.target.value)} className="mt-1 w-full min-w-0 rounded-lg border p-2.5 text-sm"><option value="all">{mine?'My assignments':'All work'}</option><option value="delegated">Delegated by me</option><option value="review">My reviews</option><option value="stale">No recent updates</option></select></label>
        <label className="text-xs">Task summary<select aria-label="Task summary filter" value={summary} onChange={e=>setSummary(e.target.value)} className="mt-1 w-full min-w-0 rounded-lg border p-2.5 text-sm"><option value="all">All tasks</option>{summaryFilters.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
        <label className="text-xs">{myScope?'Shared assignment':'Assignee'}<select aria-label={myScope?'Also assigned to':'Filter by assignee'} value={assignee} onChange={e=>setAssignee(e.target.value)} className="mt-1 w-full min-w-0 rounded-lg border p-2.5 text-sm"><option value="all">{myScope?'Anyone — all my assignments':'All assignees'}</option>{(!myScope||assignee==='unassigned')&&<option value="unassigned">Unassigned</option>}{[...people].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=><option key={id} value={id}>{name}</option>)}{assignee!=='all'&&assignee!=='unassigned'&&!people.has(assignee)&&<option value={assignee}>Selected member — no tasks</option>}</select>{myScope&&<span className="mt-1 block text-gray-500">Only your assignments are shown. Choose a teammate to find tasks you share with them.</span>}</label>
        <label className="text-xs">Priority<select aria-label="Filter by priority" value={priority} onChange={e=>setPriority(e.target.value)} className="mt-1 w-full min-w-0 rounded-lg border p-2.5 text-sm"><option value="all">All priorities</option>{['low','medium','high','urgent'].map(x=><option key={x}>{x}</option>)}</select></label>
        {!projectId&&<label className="text-xs">Project<select aria-label="Filter by project" value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="mt-1 w-full min-w-0 rounded-lg border p-2.5 text-sm"><option value="">All projects</option>{data?.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      </div>
      <div className="flex gap-2"><button type="button" onClick={resetFilters} className="rounded-lg border px-3 py-2 text-sm">Reset filters</button><button type="button" onClick={()=>setFiltersOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Close filters</button></div>
      {!archived&&<SavedTaskViews views={data?.views||[]} filters={{...JSON.parse(key),q:search,creator:creatorColumn}} onChange={views=>setData(current=>current?{...current,views}:current)}/>}
    </section>
    <div className="task-secondary-toolbar flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs">Sort<select aria-label="Sort tasks" value={sort} onChange={e=>setSort(e.target.value)} className="min-w-0 rounded-lg border px-2 py-2 text-sm"><option value="deadline">Deadline</option><option value="priority">Priority</option><option value="title">Title</option><option value="assignee">Assignee</option></select></label>
      <button type="button" disabled={busy} title="Export CSV" onClick={download} className="min-h-11 min-w-11 justify-center inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Download size={16} aria-hidden="true"/><span className="sr-only sm:not-sr-only">Export CSV</span></button>
      <button type="button" aria-expanded={columnsOpen} aria-controls={columnsId} onClick={()=>setColumnsOpen(!columnsOpen)} title="Columns" className="min-h-11 min-w-11 justify-center inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Columns3 size={16} aria-hidden="true"/><span className="sr-only sm:not-sr-only">Columns</span></button>
      <div className="mobile-task-controls"><div role="group" aria-label="Mobile task presentation" className="inline-flex rounded-full border p-1">{[['rows','Compact rows'],['table','Table']].map(([value,label])=><button key={value} type="button" aria-pressed={mobileView===value} onClick={()=>setMobileView(value)} className={`rounded-full px-3 py-2 text-sm ${mobileView===value?'bg-blue-600 text-white':''}`}>{label}</button>)}</div></div>
      {!archived&&<button type="button" className="rounded-full border px-3 py-2 text-sm" aria-pressed={selectionMode||selected.length>0} onClick={()=>{setSelectionMode(!(selectionMode||selected.length>0));setSelection({key:selectionKey,ids:[]});}}>{selectionMode||selected.length>0?'Done selecting':'Select tasks'}</button>}
    </div>
    <div id={columnsId} hidden={!columnsOpen} className="rounded-xl border bg-surface p-3"><label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={showCreator} onChange={event=>setCreatorColumn(event.target.checked?'on':'off')}/>Show Created by column</label></div>
    {!archived&&<div className="task-bulk-controls flex flex-wrap items-center gap-3"><BulkTaskActions selection={(busy?[]:selectedRows).map(t=>({id:t.id,version:Number(t.review_version)}))} people={(data?.people||[]).filter(p=>p.is_active!==false)} onDone={()=>{setSelection({key:selectionKey,ids:[]});setFocusVersion(n=>n+1);}}/>{selected.length>0&&<button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setSelection({key:selectionKey,ids:[]})}>Clear selection</button>}<span className="text-xs text-gray-500">Select tasks you created or manage.</span></div>}
    <div className="task-table-container overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{!archived&&<th className="task-select-cell p-4"><input type="checkbox" aria-label="Select eligible tasks on this page" disabled={busy||!eligible.length} checked={eligible.length>0&&eligible.every(t=>selected.includes(t.id))} onChange={e=>setSelection({key:selectionKey,ids:e.target.checked?eligible.map(t=>t.id):[]})}/><span className="mobile-task-select-label">Select eligible tasks on this page</span></th>}{['Task', 'Assignee', ...(showCreator ? ['Created by'] : []), 'Status', 'Priority', 'Deadline'].map(h => <th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead>
        <tbody>{filtered.map(t => <tr key={t.id} className="border-t border-gray-200 hover:bg-gray-50">
          {!archived&&<td className="task-select-cell p-4"><input type="checkbox" aria-label={'Select task '+t.title} disabled={!t.can_manage||busy} checked={selected.includes(t.id)} onChange={e=>setSelection({key:selectionKey,ids:e.target.checked?[...selected,t.id]:selected.filter(id=>id!==t.id)})}/></td>}
          <td className="task-title-cell p-4 min-w-56">{onOpen ? <button onClick={() => onOpen(t.id)} className="text-left font-semibold text-blue-700">{t.title}</button> : <Link className="font-semibold text-blue-700" href={`/dashboard/projects/${t.project_id}?task=${t.id}`}>{t.title}</Link>}{activityLabel(t.last_activity,today,t.status)&&<p className="mt-1 text-xs text-amber-700">{activityLabel(t.last_activity,today,t.status)}</p>}{t.project && <p className="mt-1 text-xs text-gray-500">{t.project.name}</p>}</td>
          <td className="task-assignee-cell min-w-48 p-4"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs text-blue-700">{initials(assigneeNames(t) || '?')}</span>{assigneeNames(t) || 'Unassigned'}{t.assignee?.is_active===false?' · Inactive':''}</td>
          {showCreator && <td className="task-creator-cell p-4"><span className="mobile-task-field-label">Created by </span>{t.creator?.full_name || t.creator?.email || 'Unavailable'}</td>}
          <td className="task-status-cell p-4 capitalize whitespace-nowrap"><span className="task-status-label" data-status={t.status}>{t.status==='in_review'?'In review':t.status.replaceAll('_', ' ')}</span></td><td className="task-priority-cell p-4 capitalize"><span className="task-priority-label" data-priority={t.priority}>{t.priority}</span></td><td className="task-deadline-cell p-4 whitespace-nowrap">{deadlineLabel(t.due_date, t.status, today)}</td>
        </tr>)}</tbody></table>
      {!busy&&!error&&!filtered.length && <div className="space-y-2 p-8 text-center text-gray-500"><p>No matching tasks.</p><button type="button" onClick={resetFilters} className="rounded-lg border px-3 py-2 text-sm">Clear filters</button></div>}
    </div>{(data?.total||0)>25&&<nav aria-label="Task pages" className="flex items-center gap-4 text-sm"><button disabled={busy||(data?.page||1)<=1} onClick={()=>setPage(String((data?.page||1)-1))} className="rounded-lg border p-3 disabled:opacity-40">Previous</button><span>Page {data?.page||1} of {Math.ceil((data?.total||0)/25)}</span><button disabled={busy||(data?.page||1)*25>=(data?.total||0)} onClick={()=>setPage(String((data?.page||1)+1))} className="rounded-lg border p-3 disabled:opacity-40">Next</button></nav>}<p className="text-xs text-gray-500">{data?.total||0} matching tasks · Showing {filtered.length} · Deadlines use India time · CSV opens in Excel</p>
  </div>;
}
