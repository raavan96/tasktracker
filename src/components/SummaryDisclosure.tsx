'use client';
import {useId,useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
export default function SummaryDisclosure({label,summary,preference,initialOpen,children}:{label:string;summary:string;preference:string;initialOpen:boolean;children:ReactNode}){
 const [open,setOpen]=useState(initialOpen),id=useId();
 return <section aria-label={label} className="rounded-xl border bg-surface p-3"><button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>{document.cookie=preference+'='+String(!value)+'; Path=/; Max-Age=31536000; SameSite=Lax';return !value;})}><span><strong className="text-sm">Task overview</strong><span className="mt-1 block text-xs text-gray-500 tabular-nums">{summary}</span></span><ChevronDown aria-hidden="true" className={'h-4 w-4 shrink-0 '+(open?'rotate-180':'')}/></button><div id={id} hidden={!open} className="pt-3">{children}</div></section>;
}
