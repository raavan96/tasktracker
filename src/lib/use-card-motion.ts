'use client';
import {useLayoutEffect,useRef,type RefObject} from 'react';
// FLIP: read positions once before/after a user change; animate transforms only.
// No timers, observers, duplicate card trees or animation dependency.
export function useCardMotion(root:RefObject<HTMLElement|null>,layoutKey:string){
 const before=useRef(new Map<string,DOMRect>()),running=useRef<Animation[]>([]);
 function capture(){
  const cards=[...(root.current?.querySelectorAll<HTMLElement>('[data-project-id]')||[])];
  before.current.clear();
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&cards.length<=100){for(const card of cards){const box=card.getBoundingClientRect();if(box.bottom>=0&&box.top<=window.innerHeight)before.current.set(card.dataset.projectId!,box);}}
  running.current.forEach(a=>a.cancel());running.current=[];
 }
 useLayoutEffect(()=>{
  if(!before.current.size)return;
  const pairs=[...(root.current?.querySelectorAll<HTMLElement>('[data-project-id]')||[])].map(card=>({card,old:before.current.get(card.dataset.projectId!),box:card.getBoundingClientRect()}));before.current.clear();
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(const {card,old,box} of pairs){if(!old||!box.width||!box.height||typeof card.animate!=='function')continue;running.current.push(card.animate([{opacity:.7,transform:`translate(${old.left-box.left}px,${old.top-box.top}px)`},{opacity:1,transform:'none'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'}));}
 },[layoutKey,root]);
 useLayoutEffect(()=>()=>running.current.forEach(a=>a.cancel()),[]);
 return capture;
}
