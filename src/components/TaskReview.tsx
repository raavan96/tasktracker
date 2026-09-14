'use client';
import {useState} from 'react';
import {reviewTask} from '@/app/dashboard/tasks/review';
import type {Task} from '@/lib/task-types';
export default function TaskReview({task,userId,isAdmin,readOnly,reviewEnabled,onBusyChange}:{task:Task;userId:string;isAdmin:boolean;readOnly:boolean;reviewEnabled:boolean;onBusyChange?:(busy:boolean)=>void}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const reviewer=(isAdmin||(reviewEnabled&&task.created_by===userId))&&task.assignee_id!==userId;
 const submitter=isAdmin||task.assignee_id===userId;
 async function run(action:string){setBusy(true);onBusyChange?.(true);setError('');try{const r=await reviewTask(task.id,task.project_id,Number(task.review_version||0),action,reason);if(r.error)setError(r.error);else setReason('');}catch{setError('Could not confirm the review. Refresh and try again.');}finally{setBusy(false);onBusyChange?.(false);}}
 return <section className="my-4 rounded-xl border bg-surface p-4 space-y-3" aria-label="Task review"><h3 className="font-semibold">Review</h3><p className="text-sm text-gray-500">{reviewEnabled?'The task creator or an admin can review delegated work.':'An admin can review delegated work.'} You cannot approve a task assigned to yourself.</p>{task.assignee?.is_active===false&&<p className="text-sm text-orange-700">The assignee is inactive. Ask an admin to reassign this work.</p>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 {(task.status==='in_review'||task.status==='done')&&!readOnly&&<form onSubmit={e=>e.preventDefault()}><label className="block text-sm">Review feedback / reason<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} className="mt-1 w-full rounded-lg border p-3" placeholder="Required when requesting changes, withdrawing or reopening."/></label></form>}
 <div className="flex flex-wrap gap-2">
 <button disabled={readOnly||busy||!submitter||!task.assignee_id||task.assignee?.is_active===false||['done','in_review'].includes(task.status)} onClick={()=>run('submit')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Ready for review</button>
 <button disabled={readOnly||busy||!reviewer||task.status!=='in_review'} onClick={()=>run('approve')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Approve & complete</button>
 {task.status==='in_review'&&<><button disabled={readOnly||busy||!reviewer||!reason.trim()} onClick={()=>run('changes')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Request changes</button><button disabled={readOnly||busy||!submitter||!reason.trim()} onClick={()=>run('withdraw')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Withdraw submission</button></>}
 {task.status==='done'&&(isAdmin||task.created_by===userId)&&<button disabled={readOnly||busy||!reason.trim()} onClick={()=>run('reopen')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Reopen task</button>}
 </div>{!task.assignee_id&&<p className="text-sm text-gray-500">Assign an active teammate before submitting.</p>}{task.status==='in_review'&&!reviewer&&<p className="text-sm text-gray-500">Waiting for an eligible creator or another admin to review.</p>}</section>;
}
