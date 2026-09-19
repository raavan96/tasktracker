'use client';
import {useCallback,useEffect,useRef} from 'react';
export default function ActionsMenu({label,children}:{label:string;children:React.ReactNode}){
 const ref=useRef<HTMLDetailsElement>(null);
 const position=useCallback(()=>{
  const details=ref.current;
  const menu=details?.querySelector<HTMLDivElement>('[data-actions-menu]');
  if(!details?.open||!menu)return;
  // A dialog can clip the menu even when it fits inside the browser viewport.
  let left=8,right=document.documentElement.clientWidth-8;
  for(let parent=details.parentElement;parent;parent=parent.parentElement){
   const style=getComputedStyle(parent);
   if(/auto|scroll|hidden|clip/.test(style.overflowX)){
    const box=parent.getBoundingClientRect();
    left=Math.max(left,box.left+parent.clientLeft+8);
    right=Math.min(right,box.left+parent.clientLeft+parent.clientWidth-8);
   }
  }
  const available=Math.max(0,right-left);
  menu.style.minWidth=`${Math.min(208,available)}px`;
  menu.style.maxWidth=`${available}px`;
  const box=details.getBoundingClientRect(),width=menu.getBoundingClientRect().width;
  menu.style.left=`${Math.max(left,Math.min(box.right-width,right-width))-box.left}px`;
 },[]);
 useEffect(()=>{
  const outside=(e:PointerEvent)=>{if(ref.current?.open&&!ref.current.contains(e.target as Node))ref.current.open=false;};
  document.addEventListener('pointerdown',outside);
  window.addEventListener('resize',position);
  const observer=new ResizeObserver(position);
  if(ref.current?.parentElement)observer.observe(ref.current.parentElement);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',position);observer.disconnect();};
 },[position]);
 return <details onToggle={position} ref={ref} className="relative" onKeyDown={e=>{if(e.key==='Escape'&&ref.current?.open){e.preventDefault();e.stopPropagation();ref.current.open=false;ref.current.querySelector('summary')?.focus();}}}>
 <summary className="cursor-pointer rounded-lg border px-3 py-2 text-sm">{label}</summary>
 <div data-actions-menu className="absolute left-0 top-full z-20 mt-1 min-w-52 rounded-lg border bg-surface p-2 shadow-lg" onClick={e=>{if((e.target as HTMLElement).closest('button,a')&&ref.current)ref.current.open=false;}}>{children}</div>
 </details>;
}
