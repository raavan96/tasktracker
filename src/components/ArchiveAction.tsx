'use client';
import {useState} from 'react';
import {Archive,ArchiveRestore,CheckCircle2} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {changeArchive,bulkArchive} from '@/app/dashboard/archive/actions';
import Modal from './Modal';
export default function ArchiveAction({kind,id,archived=false,unfinished=0,recurring=false,bulk=false,complete=false}:{kind:'project'|'task';id:string;archived?:boolean;unfinished?:number;recurring?:boolean;bulk?:boolean;complete?:boolean}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[days,setDays]=useState(30),[undo,setUndo]=useState(false);
 const [undoTarget,setUndoTarget]=useState(archived);
 const router=useRouter();const label=complete?'Complete project':bulk?'Archive completed tasks…':`${archived?'Restore':'Archive'} ${kind}`;
 const ActionIcon=complete?CheckCircle2:archived?ArchiveRestore:Archive;
 async function submit(revert=false){setBusy(true);setMessage('');try{
   const result=bulk?await bulkArchive(id,days):await changeArchive(kind,id,revert?undoTarget:!archived,true,complete&&!revert);
   if(result.error){setMessage(result.error);return;}
   if(!revert)setUndoTarget(archived);if(!archived&&!bulk&&!revert)window.dispatchEvent(new CustomEvent('tasktracker:archived',{detail:{kind,id}}));setOpen(false);setUndo(!bulk&&!revert);setMessage(bulk?`${'count' in result?result.count:0} completed tasks archived.`:revert?'Action undone.':`${kind==='project'?'Project':'Task'} ${archived?'restored':'archived'}.`);router.refresh();
 }catch{setMessage('The action could not finish. Please retry.');}finally{setBusy(false);}}
 return <div><button type="button" disabled={busy} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={()=>setOpen(true)}><ActionIcon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}</button>
 {message&&<p role="status" className="p-2 text-sm">{message}{undo&&<button className="ml-2 underline" disabled={busy} onClick={()=>submit(true)}>Undo</button>}</p>}
 {open&&<Modal title={label.replace('…','')} busy={busy} onClose={()=>setOpen(false)}><div className="space-y-4">
 <p>{complete?'Complete this project and move it to Archive → Completed projects. All tasks must be completed first.':archived?'Restore this item to the active workspace.':bulk?'Archive your completed tasks older than the chosen age. Recurring tasks are excluded.':'Keep all details, remarks, files and history in the archive. Restore this item before making changes.'}</p>
 {!archived&&kind==='project'&&unfinished>0&&<p className="rounded-lg border border-amber-400 p-3">This project has {unfinished} unfinished tasks. Archiving pauses work and reminders for the whole project.</p>}
 {!archived&&recurring&&<p>Recurring assignments will pause while this item is archived.</p>}
 {bulk&&<label className="block">Completed at least this many days ago<input className="mt-2 w-full rounded-lg border p-3" type="number" min="1" max="3650" value={days} onChange={e=>setDays(Number(e.target.value))}/></label>}
 {message&&<p role="alert">{message}</p>}
 <div className="flex gap-3"><button disabled={busy} className="rounded-lg border px-4 py-2" onClick={()=>setOpen(false)}>Cancel</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white" onClick={()=>submit()}>{busy?'Saving…':'Confirm'}</button></div>
 </div></Modal>}
 </div>;
}
