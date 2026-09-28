'use client';
import {useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {CircleHelp,X} from 'lucide-react';
import Modal from './Modal';
import {workspaceHelpSteps} from '@/lib/workspace-help';
const subscribe=(notify:()=>void)=>{window.addEventListener('tasktracker-tour',notify);return()=>window.removeEventListener('tasktracker-tour',notify);};
export default function WorkspaceHelp({userId,isAdmin=false,buttonOnly=false}:{userId:string;isAdmin?:boolean;buttonOnly?:boolean}){
 const steps=workspaceHelpSteps(isAdmin);
 const key='tasktracker-tour-v1:'+userId;
 const seen=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)==='seen';}catch{return false;}},()=>true);
 const [open,setOpen]=useState(false),[step,setStep]=useState(0);
 function dismiss(){try{localStorage.setItem(key,'seen');}catch{}window.dispatchEvent(new Event('tasktracker-tour'));}
 function start(){setStep(0);setOpen(true);}
 function close(){setOpen(false);dismiss();}
 return <>{buttonOnly?<button type="button" aria-label="Help and tutorial" title="Help and tutorial" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={start}><CircleHelp className="h-5 w-5"/></button>:!seen&&<aside className="workspace-welcome" aria-label="Getting started"><div><strong>Welcome to TaskTracker</strong><p className="text-gray-500">Take a quick tour. You can reopen it anytime with Help.</p></div><div className="flex items-center gap-2"><button type="button" onClick={start} className="rounded-lg border px-3 py-2">Start tutorial</button><button type="button" aria-label="Dismiss welcome" onClick={dismiss} className="rounded-lg p-2"><X className="h-4 w-4"/></button></div></aside>}{open&&<Modal title="TaskTracker help" onClose={close}><p className="mb-3 text-sm text-gray-500">Step {step+1} of {steps.length}</p><h3 className="mb-3 text-lg font-semibold">{steps[step].title}</h3><p className="leading-relaxed">{steps[step].body}</p><Link onClick={close} href={steps[step].href} className="mt-5 inline-block text-blue-600 underline">{steps[step].link}</Link><nav aria-label="Tutorial steps" className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={()=>setStep(n=>n-1)} disabled={step===0} className="rounded-lg border px-4 py-2 disabled:opacity-50">Previous</button>{step<steps.length-1?<button type="button" onClick={()=>setStep(n=>n+1)} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Next</button>:<button type="button" onClick={close} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Finish tutorial</button>}</nav></Modal>}</>;
}
