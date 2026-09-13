'use client';
import {useEffect,useRef} from 'react';
export default function ActionsMenu({label,children}:{label:string;children:React.ReactNode}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(ref.current?.open&&!ref.current.contains(e.target as Node))ref.current.open=false;};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 return <details ref={ref} className="relative" onKeyDown={e=>{if(e.key==='Escape'&&ref.current?.open){e.preventDefault();e.stopPropagation();ref.current.open=false;ref.current.querySelector('summary')?.focus();}}}>
 <summary className="cursor-pointer rounded-lg border px-3 py-2 text-sm">{label}</summary>
 <div className="absolute right-0 top-full z-20 mt-1 min-w-52 rounded-lg border bg-surface p-2 shadow-lg" onClick={e=>{if((e.target as HTMLElement).closest('button,a')&&ref.current)ref.current.open=false;}}>{children}</div>
 </details>;
}
