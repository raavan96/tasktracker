'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {Check} from 'lucide-react';
export default function IconChoiceMenu({label,icon,value,onChange,options}:{label:string;icon:ReactNode;value:string;onChange:(value:string)=>void;options:{value:string;label:string}[]}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();return()=>document.removeEventListener('pointerdown',outside);},[open]);
 function close(){setOpen(false);trigger.current?.focus();}
 return <div ref={root} className="relative" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close();}if(open&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...root.current!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];const i=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}}>
 <button type="button" ref={trigger} aria-label={label} title={`${label}: ${options.find(o=>o.value===value)?.label||''}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);}}} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-surface text-gray-600 hover:bg-gray-100">{icon}</button>
 {open&&<div id={id} role="menu" aria-label={label} className="icon-choice-menu absolute right-0 top-full z-20 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border bg-surface p-1.5 shadow-lg">{options.map(o=><button key={o.value} type="button" role="menuitemradio" aria-checked={value===o.value} tabIndex={-1} onClick={()=>{onChange(o.value);close();}} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100">{o.label}{value===o.value&&<Check aria-hidden="true" className="h-4 w-4"/>}</button>)}</div>}
 </div>;
}
