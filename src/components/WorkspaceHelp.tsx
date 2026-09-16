'use client';
import {useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {CircleHelp,X} from 'lucide-react';
import Modal from './Modal';
const subscribe=(notify:()=>void)=>{window.addEventListener('tasktracker-tour',notify);return()=>window.removeEventListener('tasktracker-tour',notify);};
const steps=[
 {title:'Welcome to TaskTracker',body:'Start in Projects to find your team’s work. Dashboard shows project progress, task status, workload and upcoming deadlines. Use the icons in the sidebar, or Menu on your phone.',href:'/dashboard/insights',link:'Open Dashboard'},
 {title:'Create and delegate work',body:'Open a project and choose New Task. Add a clear title, deadline and priority, then select one or more assignees. Project members share access; private projects stay limited to their team. Task actions and Project actions contain editing and archive options.',href:'/dashboard',link:'Open Projects'},
 {title:'Share updates and mentions',body:'Open a task and use Updates to add remarks or files. Type @ and a teammate’s name, then press Enter to select the highlighted person. The creator, assignees and permitted teammates can follow progress.',href:'/dashboard/my-tasks',link:'Open My Tasks'},
 {title:'Submit and approve work',body:'The creator, an assignee or an admin can choose Ready for review after completing the checklist. An admin or an eligible creator outside the assignee group can approve. Admins may approve their own work. Requested changes return the task to In Progress.',href:'/dashboard/tasks',link:'Open All Tasks'},
 {title:'Stay on top of deadlines',body:'Use Calendar to plan deadlines and Notifications to see assignments, mentions and review updates. Assignment emails and weekly reports are managed by the workspace. For account access or a problem with a task, contact your workspace admin.',href:'/dashboard/notifications',link:'Open Notifications'}
];
export default function WorkspaceHelp({userId,buttonOnly=false}:{userId:string;buttonOnly?:boolean}){
 const key='tasktracker-tour-v1:'+userId;
 const seen=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)==='seen';}catch{return false;}},()=>true);
 const [open,setOpen]=useState(false),[step,setStep]=useState(0);
 function dismiss(){try{localStorage.setItem(key,'seen');}catch{}window.dispatchEvent(new Event('tasktracker-tour'));}
 function start(){setStep(0);setOpen(true);}
 function close(){setOpen(false);dismiss();}
 return <>{buttonOnly?<button type="button" aria-label="Help and tutorial" title="Help and tutorial" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={start}><CircleHelp className="h-5 w-5"/></button>:!seen&&<aside className="workspace-welcome" aria-label="Getting started"><div><strong>Welcome to TaskTracker</strong><p className="text-gray-500">Take a quick tour. You can reopen it anytime with Help.</p></div><div className="flex items-center gap-2"><button type="button" onClick={start} className="rounded-lg border px-3 py-2">Start tutorial</button><button type="button" aria-label="Dismiss welcome" onClick={dismiss} className="rounded-lg p-2"><X className="h-4 w-4"/></button></div></aside>}{open&&<Modal title="TaskTracker help" onClose={close}><p className="mb-3 text-sm text-gray-500">Step {step+1} of {steps.length}</p><h3 className="mb-3 text-lg font-semibold">{steps[step].title}</h3><p className="leading-relaxed">{steps[step].body}</p><Link onClick={close} href={steps[step].href} className="mt-5 inline-block text-blue-600 underline">{steps[step].link}</Link><nav aria-label="Tutorial steps" className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={()=>setStep(n=>n-1)} disabled={step===0} className="rounded-lg border px-4 py-2 disabled:opacity-50">Previous</button>{step<steps.length-1?<button type="button" onClick={()=>setStep(n=>n+1)} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Next</button>:<button type="button" onClick={close} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Finish tutorial</button>}</nav></Modal>}</>;
}
