'use client';
import {useEffect,useState} from 'react';
import Modal from './Modal';
import {memberImpact,changeMemberState,reassignMemberWork} from '@/app/admin/users/lifecycle';
import type {Member} from '@/lib/task-types';
export default function MemberLifecycle({member,onClose}:{member:Member;onClose:()=>void}){
 const [impact,setImpact]=useState<Awaited<ReturnType<typeof memberImpact>>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reason,setReason]=useState('');
 const [project,setProject]=useState(''),[replacement,setReplacement]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{let active=true;memberImpact(member.id).then(data=>{if(active)setImpact(data);}).catch(()=>{if(active)setError('Could not load this member’s work. Close and retry.');});return()=>{active=false};},[member.id]);
 const tasks=impact?.tasks.filter(t=>t.project_id===project)||[];
 const eligible=impact?.people.filter(p=>p.id!==member.id&&p.is_active!==false&&impact.members.some(m=>m.user_id===p.id&&m.project_id===project))||[];
 async function apply(state:boolean){setBusy(true);setError('');try{const result=await changeMemberState(member.id,state,reason);if(result.error)setError(result.error);else onClose();}catch{setError('Change could not be confirmed. Refresh before retrying.');}finally{setBusy(false);}}
 async function reassign(){setBusy(true);setError('');try{const expected=tasks.map(t=>({id:t.id,version:Number(t.review_version)})).sort((a,b)=>a.id.localeCompare(b.id));const result=await reassignMemberWork(member.id,project,replacement==='unassigned'?null:replacement,expected);if(result.error)setError(result.error);else{setImpact(await memberImpact(member.id));setPreview(false);setReplacement('');}}catch{setError('Could not confirm reassignment. Refresh the preview.');}finally{setBusy(false);}}
 return <Modal title={`Member access & work — ${member.full_name||member.email}`} onClose={onClose} busy={busy}>
 {error&&<p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}{!impact?<p>Loading affected work…</p>:<div className="space-y-5"><p className="text-sm">{impact.tasks.length} pending assignments · {impact.pendingReviews} pending creator reviews · {impact.createdProjects} created projects · {impact.recurring} recurring sources</p>
 <p className="text-sm text-gray-500">History and Created by labels are preserved. Admins retain management of this member’s projects. Deactivation blocks sign-in and revokes sessions; assignments remain visible until reassigned. Recurrence involving inactive members is held.</p>
 <form onSubmit={e=>{e.preventDefault();void apply(member.is_active===false);}} className="space-y-3"><label className="block text-sm">Reason for access change<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
 {member.is_active===false&&<p className="text-sm text-orange-700">Reactivation restores retained project access. Previously reassigned work stays with its new assignee.</p>}
 <button disabled={busy||!reason.trim()} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{member.is_active===false?'Confirm reactivation':'Confirm deactivation'}</button></form>
 <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Reassign pending work</h3><p className="text-sm text-gray-500">Completed and archived tasks stay unchanged. Submitted work returns to In progress when reassigned. Replacements must already belong to the project.</p>
 <select aria-label="Reassignment project" value={project} onChange={e=>{setProject(e.target.value);setReplacement('');setPreview(false);}} className="w-full rounded-lg border p-3"><option value="">Choose a project</option>{impact.projects.filter(p=>impact.tasks.some(t=>t.project_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <select aria-label="Replacement assignee" value={replacement} disabled={!project} onChange={e=>{setReplacement(e.target.value);setPreview(false);}} className="w-full rounded-lg border p-3"><option value="">Choose replacement</option><option value="unassigned">Leave unassigned</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select>
 <button disabled={busy||!project||!replacement||!tasks.length} onClick={()=>setPreview(true)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Preview reassignment</button>
 {preview&&<div className="rounded-lg border p-3 text-sm"><p className="font-semibold">{tasks.length} tasks → {replacement==='unassigned'?'Unassigned':eligible.find(p=>p.id===replacement)?.full_name||eligible.find(p=>p.id===replacement)?.email}</p><ul className="my-3 list-disc pl-5">{tasks.map(t=><li key={t.id}>{t.title} · {t.status.replaceAll('_',' ')}</li>)}</ul><button disabled={busy} onClick={reassign} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Confirm reassignment</button></div>}</section>
 <section className="border-t pt-4"><h3 className="font-semibold">Member history</h3>{impact.events.map(event=><p key={event.id} className="mt-2 text-sm">{event.action.replaceAll('_',' ')} · {event.reason}<span className="block text-xs text-gray-500">{impact.people.find(p=>p.id===event.actor_id)?.full_name||'System'} · {new Date(event.created_at).toLocaleString()}</span></p>)}</section>
 </div>}
 </Modal>;
}
