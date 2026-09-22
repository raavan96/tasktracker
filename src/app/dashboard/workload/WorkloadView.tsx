'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Info} from 'lucide-react';
import {deadlineLabel,initials} from '@/lib/task-presentation';
import {assignedIds} from '@/lib/task-types';
import {workloadStatuses} from '@/lib/workload';
import type {WorkloadModel} from '@/lib/workload';
import styles from './workload.module.css';
export default function WorkloadView({model,today}:{model:WorkloadModel;today:string}){
 const [selected,setSelected]=useState(model.rows[0]?.id||'unassigned');const [limit,setLimit]=useState(4);
 const person=model.rows.find(p=>p.id===selected)||model.rows[0];
 const url=(summary:string)=>`/dashboard/tasks?assignee=${person.id}&summary=${summary}`;
 return <><div className={styles.panels}>
 <section className={styles.panel} aria-label="Work distribution"><h2>Work distribution</h2><p className={styles.muted}>Select a member to explore their tasks.</p>
 <div className={styles.legend}>{workloadStatuses.map(s=><span key={s.id}><i className={styles.swatch} data-status={s.id}/>{s.label}</span>)}</div>
 <div className={styles.axis} aria-hidden="true">{[0,1,2,3].map(n=><span key={n}>{Math.round(model.axisMax*n/3)}{n===3?' tasks':''}</span>)}</div>
 <div className={styles.members}>{model.rows.map(p=><button key={p.id} type="button" data-member={p.id} className={styles.member} aria-pressed={person.id===p.id} aria-controls="workload-member-details" aria-label={`${p.name}: ${p.pending} pending, ${p.overdue} overdue`} onClick={()=>{setSelected(p.id);setLimit(4);}}>
 <span className={styles.memberName}>{p.name}<small>{!p.active?'Inactive · ':''}{p.overdue?`${p.overdue} overdue`:'No overdue tasks'}</small></span>
 <span className={styles.track} aria-hidden="true">{workloadStatuses.map((s,i)=><span key={s.id} data-status={s.id} style={{width:`${p.segments[i]/model.axisMax*100}%`}}/>)}</span><span className={styles.number}>{p.pending}</span><span className="sr-only">{workloadStatuses.map((s,i)=>`${s.label}: ${p.segments[i]}`).join(', ')}</span></button>)}</div>
 <p className={styles.note}>Task counts indicate volume, not effort or available capacity. Overdue tasks are included in pending work.</p></section>
 <section className={styles.panel} id="workload-member-details" aria-label="Selected member workload" aria-live="polite"><div className={styles.detailHead}><span className={styles.avatar} aria-hidden="true">{initials(person.name)}</span><div><h2>{person.name}</h2><p className={styles.muted}>{person.pending} pending · {person.done} completed{!person.active?' · Inactive':''}</p></div></div>
 <div className={styles.detailStats}>{[{key:'overdue',label:'Overdue',n:person.overdue},{key:'in_review',label:'In review',n:person.in_review},{key:'blocked',label:'Blocked',n:person.blocked},{key:'done',label:'Completed',n:person.done}].map(s=><Link href={url(s.key)} key={s.key} aria-label={`${person.name}: ${s.key==='done'?'done':s.key==='in_review'?'in review':s.key} tasks`}><span>{s.label}</span><strong>{s.n}</strong></Link>)}</div>
 <div>{person.tasks.slice(0,limit).map(t=><article key={t.id} className={styles.task}><Link className={styles.taskTitle} href={`/dashboard/projects/${t.project_id}?task=${t.id}`}>{t.title}</Link><p className={styles.project}>{t.project?.name||'Project'}{assignedIds(t).length>1?' · Shared task':''}</p><div className={styles.taskMeta}><span className={styles.badge} data-status={t.status}>{workloadStatuses.find(s=>s.id===t.status)?.label||t.status}</span><span>{t.status==='in_review'?'Awaiting approval':deadlineLabel(t.due_date,t.status,today)}</span></div></article>)}</div>
 {!person.tasks.length&&<p className={styles.empty}>No pending tasks{person.id==='unassigned'?' without an assignee':' for this member'}.</p>}
 {person.tasks.length>4&&<button type="button" className={styles.more} onClick={()=>setLimit(limit>=person.tasks.length?4:limit+20)}>{limit>=person.tasks.length?'Show fewer tasks':`Show more tasks (${Math.min(limit,person.tasks.length)} of ${person.tasks.length})`}</button>}
 <Link className={styles.all} href={url('pending')} aria-label={`${person.name}: pending tasks`}>Open all pending tasks →</Link>
 </section></div><p className={styles.footnote}><Info className="h-4 w-4 shrink-0" aria-hidden="true"/>Active projects only. The summary counts each task once; shared tasks appear under every assignee. Dates use India time (IST).</p></>;
}
