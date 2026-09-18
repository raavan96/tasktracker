'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {morningTasks,resolveMorningTask} from '@/app/dashboard/tasks/morning';
export default function MorningPrompt({userId}:{userId:string}){
 const [data,setData]=useState<Awaited<ReturnType<typeof morningTasks>>|null>(null),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;morningTasks().then(r=>{if(!live||r.local_hour<6||r.local_hour>=12)return;try{if(localStorage.getItem(`morning:${userId}`)===r.today)return;}catch{}setData(r);}).catch(()=>{});return()=>{live=false};},[userId]);
 if(!data)return null;
 if(!data.items.length)return message?<p role="status" className="mb-4 rounded-lg border p-3 text-sm">{message}</p>:null;
 return <section className="morning-prompt rounded-xl border bg-surface p-4 mb-5" aria-label="Morning catch-up"><div className="flex justify-between gap-4"><h2 className="font-semibold">A fresh start for overdue tasks</h2><button aria-label="Dismiss morning prompt for today" onClick={()=>{try{localStorage.setItem(`morning:${userId}`,data.today);}catch{}setData(null);}}>×</button></div><p className="my-2 text-sm text-gray-500">These assignments slipped past yesterday. Mark Done submits work for approval.</p>{message&&<p role="status" className="text-sm my-2">{message}</p>}{data.items.map(t=><div key={t.id} className="flex flex-wrap justify-between items-center gap-3 border-t py-3"><Link className="text-sm font-medium" href={`/dashboard/projects/${t.project_id}?task=${t.id}`}>{t.title}</Link><div className="flex gap-2">{(['today','done'] as const).map(a=><button disabled={!!busy} key={a} className="rounded-lg border p-2 text-sm" onClick={async()=>{setBusy(t.id);try{const r=await resolveMorningTask(t.id,Number(t.review_version),a);setMessage(r.error||r.message||'');if(!r.error)setData({...data,items:data.items.filter(x=>x.id!==t.id)});}catch{setMessage('Could not confirm the change. Please retry.');}finally{setBusy('');}}}>{a==='today'?'Reschedule to today':'Mark Done'}</button>)}</div></div>)}</section>;
}
