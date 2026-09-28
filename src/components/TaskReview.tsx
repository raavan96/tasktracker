'use client';
import {useState} from 'react';
import {Check, RotateCcw, Undo2, MessageSquare, ArrowRight} from 'lucide-react';
import {reviewTask} from '@/app/dashboard/tasks/review';
import {assignedIds,type Task} from '@/lib/task-types';
import ActionsMenu from './ActionsMenu';

type ActiveStatus='todo'|'in_progress'|'blocked';
const labels:Record<string,string>={todo:'To do',in_progress:'In progress',blocked:'Blocked',in_review:'In review',done:'Completed'};
const reasonLabels={changes:'Request changes',withdraw:'Withdraw submission',reopen:'Reopen task'};
export default function TaskReview({task,userId,isAdmin,readOnly,reviewEnabled,onBusyChange,onStatusChange,externalBusy=false}:{task:Task;userId:string;isAdmin:boolean;readOnly:boolean;reviewEnabled:boolean;onBusyChange?:(busy:boolean)=>void;onStatusChange:(status:ActiveStatus)=>Promise<void>;externalBusy?:boolean}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [reasonAction,setReasonAction]=useState<keyof typeof reasonLabels|null>(null);
 const ids=assignedIds(task),reviewer=isAdmin||(reviewEnabled&&task.created_by===userId&&!ids.includes(userId)),submitter=isAdmin||task.created_by===userId||ids.includes(userId);
 const active=task.assignees?task.assignees.every(m=>m.is_active!==false):task.assignee?.is_active!==false;
 const working=!['done','in_review'].includes(task.status);
 const submit=!readOnly&&submitter&&ids.length>0&&active&&working,decide=!readOnly&&reviewer&&task.status==='in_review',withdraw=!readOnly&&submitter&&task.status==='in_review',reopen=!readOnly&&task.status==='done'&&(isAdmin||task.created_by===userId);
 const changeStatus=!readOnly&&submitter&&working;
 const disabled=busy||externalBusy;
 const creatorEligible=task.creator?.is_active!==false&&(task.creator?.role==='admin'||(reviewEnabled&&!ids.includes(task.created_by)));
 const waiting=creatorEligible&&task.creator?.full_name?`${task.creator.full_name} or an admin`:'an admin';
 const assignees=task.assignees?.map(m=>m.full_name).join(', ')||task.assignee?.full_name||'an assignee';
 const next=readOnly?'Archived work is read-only.':task.status==='in_review'?`Waiting for ${waiting}`:task.status==='done'?task.completed_at?`Completed ${new Date(task.completed_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST`:'Work is complete.':!ids.length?'Assign a teammate before submitting for review.':!active?'Reassign inactive teammates before submitting this shared task for review.':`Next: ${assignees} · ${task.status==='blocked'?'resolve the blocker, then continue work':'complete the work and submit for review'}`;
 async function run(action:string){setBusy(true);onBusyChange?.(true);setError('');try{const r=await reviewTask(task.id,task.project_id,Number(task.review_version||0),action,reason);if(r.error)setError(r.error);else {setReason('');setReasonAction(null);}}catch{setError('Could not confirm the review. Refresh and try again.');}finally{setBusy(false);onBusyChange?.(false);}}
 function choose(action:keyof typeof reasonLabels){setReasonAction(action);setError('');}
 const reasonAllowed=reasonAction==='changes'?decide:reasonAction==='withdraw'?withdraw:reasonAction==='reopen'?reopen:false;
 return <section className="my-4 space-y-3 rounded-xl border bg-surface p-4" aria-label="Task review">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h3 className="font-semibold" aria-label="Current task status">{labels[task.status]||task.status}</h3><p className="mt-1 text-sm text-gray-500">{next}</p></div>
   <div className="flex flex-wrap items-center gap-2">
    {submit&&<button disabled={disabled} onClick={()=>run('submit')} className="rounded-lg border px-3 py-2 text-sm">Ready for review</button>}
    {decide&&<button disabled={disabled} onClick={()=>run('approve')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Approve &amp; complete</button>}
    {reopen&&<button disabled={disabled} onClick={()=>choose('reopen')} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RotateCcw size={16} aria-hidden="true"/>Reopen task</button>}
    {(changeStatus||decide||withdraw)&&<ActionsMenu label="More status actions">
     {changeStatus&&(['todo','in_progress','blocked'] as const).filter(status=>status!==task.status).map(status=><button key={status} disabled={disabled} onClick={()=>onStatusChange(status)}><ArrowRight size={16} aria-hidden="true"/>Move to {labels[status]}</button>)}
     {decide&&<button disabled={disabled} onClick={()=>choose('changes')}><MessageSquare size={16} aria-hidden="true"/>Request changes</button>}
     {withdraw&&<button disabled={disabled} onClick={()=>choose('withdraw')}><Undo2 size={16} aria-hidden="true"/>Withdraw submission</button>}
    </ActionsMenu>}
   </div>
  </div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {reasonAction&&reasonAllowed&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();if(reason.trim()&&!disabled)void run(reasonAction);}}>
   <label className="block text-sm">Review feedback / reason<textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} required maxLength={2000} className="mt-1 w-full rounded-lg border p-3" placeholder={`Reason for ${reasonLabels[reasonAction].toLowerCase()}`}/></label>
   <div className="flex flex-wrap gap-2"><button disabled={disabled||!reason.trim()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><Check size={16} aria-hidden="true"/>Confirm {reasonLabels[reasonAction].toLowerCase()}</button><button type="button" disabled={disabled} onClick={()=>{setReasonAction(null);setReason('');}} className="rounded-lg border px-3 py-2 text-sm">Cancel</button></div>
  </form>}
  <details className="text-sm text-gray-500"><summary className="cursor-pointer">Approval rules</summary><p className="mt-2">The creator, any assignee, or an admin can submit assigned work for review. All assignees share one status. Admins may approve any submitted task, including their own. Other creators may approve only when outside the assignee group and creator review is enabled.</p></details>
 </section>;
}
