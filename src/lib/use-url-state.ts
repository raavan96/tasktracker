'use client';
import {useSearchParams} from 'next/navigation';
import {useSyncExternalStore} from 'react';
const subscribe=(listener:()=>void)=>{window.addEventListener('storage',listener);window.addEventListener('tasktracker:preferences',listener);return()=>{window.removeEventListener('storage',listener);window.removeEventListener('tasktracker:preferences',listener);};};
export function useUrlState<T extends string = string>(key:string,fallback:T,options:{allowed?:readonly T[];remember?:string;replace?:boolean}={}) {
 const params=useSearchParams();
 const remembered=useSyncExternalStore(subscribe,()=>{try{return options.remember?localStorage.getItem(`tasktracker:${options.remember}`)||fallback:fallback;}catch{return fallback;}},()=>fallback);
 const candidate=params.get(key)??remembered;
 const value=(!options.allowed||options.allowed.includes(candidate as T)?candidate:fallback) as T;
 function setValue(next:T){const url=new URL(window.location.href);url.searchParams.set(key,next);window.history[options.replace?'replaceState':'pushState'](null,'',url.pathname+url.search+url.hash);
 if(options.remember){try{localStorage.setItem(`tasktracker:${options.remember}`,next);window.dispatchEvent(new Event('tasktracker:preferences'));}catch{/* Preference storage is optional. */}}
 }
 return [value,setValue] as const;
}
