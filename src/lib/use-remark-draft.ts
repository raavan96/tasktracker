'use client';
import {useSyncExternalStore} from 'react';
import {remarkDraftKey,parseRemarkDraft,type RemarkDraft} from './remark-draft';
const eventName='tasktracker:remark-draft';
function subscribe(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener(eventName,listener);return()=>{window.removeEventListener('storage',listener);window.removeEventListener(eventName,listener);};}
export function useRemarkDraft(user:string,task:string){
 const key=remarkDraftKey(user,task);
 const raw=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)||'';}catch{return '';}},()=> '');
 function write(value:RemarkDraft|null){try{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);window.dispatchEvent(new Event(eventName));return true;}catch{return false;}}
 return {draft:parseRemarkDraft(raw,user,task),write};
}
