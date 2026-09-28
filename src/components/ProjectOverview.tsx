'use client';

import {useSyncExternalStore, useState, type ReactNode} from 'react';
import styles from './project-overview.module.css';
import {ChevronDown} from 'lucide-react';

const eventName='tasktracker:project-overview';
function subscribe(listener:()=>void){
 window.addEventListener('storage',listener);
 window.addEventListener(eventName,listener);
 return ()=>{window.removeEventListener('storage',listener);window.removeEventListener(eventName,listener);};
}
export default function ProjectOverview({userId,children}:{userId:string;children:ReactNode}){
 const key=`tasktracker:project-overview:${userId}`;
 const [fallback,setFallback]=useState<boolean|null>(null);
 const open=useSyncExternalStore(subscribe,()=>{if(fallback!==null)return fallback;try{return localStorage.getItem(key)==='open';}catch{return false;}},()=>false);
 return <section className="rounded-xl border bg-surface p-4">
  <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left" aria-expanded={open} aria-controls="project-overview-content" onClick={()=>{try{localStorage.setItem(key,open?'closed':'open');window.dispatchEvent(new Event(eventName));}catch{setFallback(!open);}}}>
   <span><span className="block font-semibold">Workspace overview</span><span className="text-sm text-gray-500">Project and task summaries</span></span>
   <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open?'rotate-180':''}`}/>
  </button>
  <div id="project-overview-content" hidden={!open} className={`${styles.overview} space-y-4 pt-4`}>{children}</div>
 </section>;
}
