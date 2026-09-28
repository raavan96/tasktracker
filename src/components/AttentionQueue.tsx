'use client';

import {useState} from 'react';
import Link from 'next/link';
import {deadlineLabel} from '@/lib/task-presentation';
import type {DashboardInsights} from '@/lib/dashboard-insights';

export default function AttentionQueue({tasks,today}:{tasks:DashboardInsights['attentionTasks'];today:string}){
 const [expanded,setExpanded]=useState(false);
 return <section aria-label="Needs my attention" className="insights-box insights-wide">
  <h3>My attention queue</h3>
  <p className="insights-note">Your overdue, due today and blocked tasks, plus work you can review.</p>
  <div className="divide-y">{(expanded?tasks:tasks.slice(0,8)).map(task=><Link key={task.id} href={`/dashboard/projects/${task.project_id}?task=${task.id}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="min-w-0 break-words"><strong>{task.title}</strong><span className="block text-gray-500">{task.project}</span></span><span className="text-blue-600">{task.status==='in_review'?'Awaiting review':task.status==='blocked'?'Blocked':deadlineLabel(task.due_date,task.status,today)}</span></Link>)}</div>
  {!tasks.length&&<p className="py-3 text-sm text-gray-500">No urgent actions right now.</p>}
  {tasks.length>8&&<button type="button" aria-expanded={expanded} className="mt-3 min-h-11 rounded-lg border px-3 py-2 text-sm" onClick={()=>setExpanded(!expanded)}>{expanded?'Show fewer tasks':`Show all ${tasks.length} tasks`}</button>}
 </section>;
}
