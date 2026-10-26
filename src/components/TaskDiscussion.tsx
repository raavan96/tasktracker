'use client';
import {useEffect,useLayoutEffect,useState,useRef,useId} from 'react';
import {listRemarks,linkedRemark,saveRemark,remarkHistory,type Remark} from '@/app/dashboard/discussion/actions';
import type {Member} from '@/lib/task-types';
import {workspaceTimestamp} from '@/lib/task-presentation';
import {useRemarkDraft} from '@/lib/use-remark-draft';
import {draftMatchesSaved} from '@/lib/remark-draft';
import RemarkText from './RemarkText';
export default function TaskDiscussion({taskId,userId,members,readOnly,onBusyChange,active=true,onCountChange}:{taskId:string;userId:string;members:Member[];readOnly:boolean;onBusyChange:(busy:boolean)=>void;active?:boolean;onCountChange?:(count:number)=>void}){
 const [items,setItems]=useState<Remark[]>([]),[more,setMore]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [text,setText]=useState(''),[mentions,setMentions]=useState<string[]>([]),[editing,setEditing]=useState<Remark|null>(null),[history,setHistory]=useState<Awaited<ReturnType<typeof remarkHistory>>|null>(null);
 const {draft,write:writeDraft}=useRemarkDraft(userId,taskId);
 const [draftStarted,setDraftStarted]=useState(false),[recovering,setRecovering]=useState(false),[draftNotice,setDraftNotice]=useState(''),[storageFailed,setStorageFailed]=useState(false);
 function clearDraft(){if(!writeDraft(null))setStorageFailed(true);}
 function keepDraft(value:string,people=mentions,edit=editing){
  setDraftStarted(true);
  const unchanged=edit&&value===edit.content&&JSON.stringify([...people].sort())===JSON.stringify([...edit.mentions].sort());
  if(!value.trim()||unchanged){clearDraft();return;}
  const key=JSON.stringify([taskId,value,people,edit?.id,edit?.edit_version]);
  const ok=writeDraft({version:1,userId,taskId,text:value,mentions:people,updatedAt:Date.now(),editing:edit?{id:edit.id,edit_version:Number(edit.edit_version)}:null,request:request.current?.key===key?request.current:null});
  if(!ok)setStorageFailed(true);
 }
 async function restoreDraft(){
  if(!draft||readOnly)return;setRecovering(true);setError('');
  try{
   const id=draft.editing?.id||draft.request?.id;
   const current=id?await linkedRemark(taskId,id):null;
   if(current&&current.author_id===userId&&draftMatchesSaved(draft,current)){clearDraft();setDraftNotice('This draft was already saved.');return;}
   if(draft.editing&&(!current||current.author_id!==userId)){setError('The original remark is unavailable. Your saved draft is kept on this device.');return;}
   setEditing(draft.editing&&current?{...current,edit_version:draft.editing.edit_version}:null);
   setText(draft.text);setMentions(draft.mentions);setCaret(draft.text.length);setDraftStarted(true);request.current=draft.request;setDraftNotice('Draft restored. Review it before posting.');
  }catch{setError('The draft could not be checked. Please retry.');}finally{setRecovering(false);}
 }
 const request=useRef<{key:string;id:string}|null>(null);const saving=useRef(false);const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!active||loaded)return;let activeRequest=true;listRemarks(taskId).then(r=>{if(activeRequest){setItems(r.items);setMore(r.more);setLoaded(true);}}).catch(()=>{if(activeRequest)setError('Remarks could not load. Refresh to retry.');});return()=>{activeRequest=false};},[taskId,active,loaded]);
 useEffect(()=>{if(loaded&&draft&&items.some(item=>item.author_id===userId&&draftMatchesSaved(draft,item)))writeDraft(null);},[loaded,items,draft,writeDraft,userId]);
 const [linked,setLinked]=useState<Remark|null>(null);
 useEffect(()=>{if(!active||!loaded)return;let live=true;let timer:ReturnType<typeof setTimeout>;let frame:number;
 async function reveal(){const id=window.location.hash.match(/^#remark-([0-9a-f-]{36})$/i)?.[1];if(!id)return;try{const item=await linkedRemark(taskId,id);if(!live)return;if(!item){setError('This linked remark is unavailable or you no longer have access.');return;}setLinked(item);frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{const node=document.getElementById('remark-'+id);node?.scrollIntoView({block:'center',behavior:'instant'});node?.classList.add('remark-flash');timer=setTimeout(()=>node?.classList.remove('remark-flash'),3500);}));}catch{if(live)setError('The linked remark could not load.');}}
 void reveal();window.addEventListener('hashchange',reveal);return()=>{live=false;cancelAnimationFrame(frame);clearTimeout(timer);window.removeEventListener('hashchange',reveal);};},[active,taskId,loaded]);
 const input=useRef<HTMLTextAreaElement>(null),listId=useId();
 const pendingCaret=useRef<number|null>(null);
 useLayoutEffect(()=>{if(pendingCaret.current!==null){const position=pendingCaret.current;pendingCaret.current=null;input.current?.focus();input.current?.setSelectionRange(position,position);}},[text]);
 const [caret,setCaret]=useState(0),[selected,setSelected]=useState(0),[dismissed,setDismissed]=useState<string|null>(null);
 const prefix=text.slice(0,caret),match=prefix.match(/(?:^|\s)@([^@\n]*)$/);
 const suggestions=match&&dismissed!==prefix?members.filter(m=>m.is_active!==false&&`${m.full_name||''} ${m.email}`.toLowerCase().includes(match[1].toLowerCase())).slice(0,8):[];
 const highlighted=Math.min(selected,Math.max(0,suggestions.length-1));
 function mention(m:Member){
  if(!match)return;
  const start=prefix.lastIndexOf('@'),replacement='@'+(m.full_name||m.email)+' ',next=text.slice(0,start)+replacement+text.slice(caret),position=start+replacement.length;
  pendingCaret.current=position;
  const people=[...new Set([...mentions,m.id])];keepDraft(next,people);setMentions(people);setText(next);setCaret(position);setSelected(0);setDismissed(next.slice(0,position));setSaved(false);
 }
 function keys(e:React.KeyboardEvent<HTMLTextAreaElement>){
  if(e.nativeEvent.isComposing)return;
  if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();if(!busy&&!readOnly&&loaded&&text.trim())e.currentTarget.form?.requestSubmit();return;}
  if(!suggestions.length)return;
  if(e.key==='Enter'){e.preventDefault();mention(suggestions[highlighted]);}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setSelected((highlighted+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDismissed(prefix);}
 }
 async function submit(e:React.FormEvent){
  e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);onBusyChange(true);setError('');setSaved(false);
  const key=JSON.stringify([taskId,text,mentions,editing?.id,editing?.edit_version]);
  if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
  keepDraft(text);
  const started=performance.now();
  try{const r=await saveRemark(taskId,text,mentions,editing?.id,editing?Number(editing.edit_version):undefined,request.current.id);
   if(r.error||!r.item){setError(r.error||'The update could not be confirmed. Your draft is kept.');return;}
   const item=r.item;setItems(previous=>[item,...previous.filter(x=>x.id!==item.id)].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)));
   if(!editing)onCountChange?.(1);
   clearDraft();setDraftNotice('');setText('');setMentions([]);setEditing(null);request.current=null;setSaved(true);
  }catch{setError('The update could not be confirmed. Your draft is kept. Retry to confirm it safely.');}
  finally{performance.measure('tasktracker:remark-save',{start:started,end:performance.now()});saving.current=false;setBusy(false);onBusyChange(false);}
 }
 async function older(){setBusy(true);try{const last=items[items.length-1];const r=await listRemarks(taskId,{id:last.id,created_at:last.created_at});setItems([...items,...r.items.filter(x=>!items.some(i=>i.id===x.id))]);setMore(r.more);}catch{setError('Older remarks could not load.');}finally{setBusy(false);}}
 return <section className="space-y-3 py-4"><h3 className="font-semibold">Comments & Updates</h3>{draft&&!draftStarted&&<div role="status" className="rounded-xl border bg-surface p-3 text-sm"><p>A saved remark draft is available from {workspaceTimestamp(new Date(draft.updatedAt).toISOString())}. Drafts stay on this device for 7 days.</p><div className="mt-2 flex gap-3"><button type="button" disabled={readOnly||recovering||!loaded} className="rounded-full border px-3 py-2" onClick={restoreDraft}>{recovering?'Checking…':'Restore draft'}</button><button type="button" className="rounded-full border px-3 py-2" onClick={()=>{if(window.confirm('Discard the saved remark draft from this device?'))clearDraft();}}>Discard draft</button></div></div>}{draftNotice&&<p role="status" className="text-xs text-gray-500">{draftNotice}</p>}{storageFailed&&<p role="alert" className="text-xs text-amber-700">Device storage is unavailable. Keep this page open until your remark is saved.</p>}{saved&&<p role="status" className="text-sm text-green-700">Saved.</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{error.includes('changed')&&<button type="button" className="rounded-lg border p-2 text-sm" onClick={async()=>{if(!window.confirm('Discard your remark draft and load the latest remarks?'))return;try{const latest=await listRemarks(taskId);setItems(latest.items);setMore(latest.more);clearDraft();setDraftNotice('');setText('');setMentions([]);setEditing(null);setError('');}catch{setError('Latest remarks could not load.');}}}>Load latest remarks</button>}{!loaded&&!error&&<p>Loading remarks…</p>}{!loaded&&error&&<button type="button" onClick={async()=>{try{const r=await listRemarks(taskId);setItems(r.items);setMore(r.more);setLoaded(true);setError('');}catch{setError('Remarks could not load. Refresh to retry.');}}}>Retry loading remarks</button>}{more&&<button disabled={busy} onClick={older} className="rounded-lg border p-2 text-sm">Load older remarks</button>}{loaded&&!items.length&&<p className="text-sm text-gray-500">No comments yet. Start the conversation below.</p>}{[...items,...(linked&&!items.some(x=>x.id===linked.id)?[linked]:[])].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).map(c=><article id={'remark-'+c.id} key={c.id} className="space-y-2 rounded-lg border bg-surface p-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500"><strong>{c.author}</strong><span>{workspaceTimestamp(c.created_at)}{c.edited_at?' · Edited':''}</span></div><p className="whitespace-pre-wrap break-words text-sm"><RemarkText text={c.content}/></p><div className="flex gap-3 text-xs">{c.author_id===userId&&!readOnly&&<button disabled={busy||Boolean(draft&&!draftStarted)} onClick={()=>{if(text&&!window.confirm('Discard your current remark draft?'))return;clearDraft();setDraftStarted(true);setDraftNotice('');setEditing(c);setText(c.content);setCaret(c.content.length);setDismissed(c.content);setSelected(0);setMentions(c.mentions);setHistory(null);}} className="text-blue-600 underline">Edit remark</button>}{c.edited_at&&<button onClick={async()=>{try{setHistory(await remarkHistory(c.id));}catch{setError('Edit history could not load.');}}} className="text-blue-600 underline">Edit history</button>}</div></article>)}{history&&<div className="rounded-lg border p-3 text-sm"><h4 className="font-semibold">Previous remark versions</h4><p className="text-xs text-gray-500">Latest 100 edits</p>{history.map(h=><div key={h.id} className="my-3"><p className="text-xs text-gray-500">{workspaceTimestamp(h.created_at)}</p><p className="whitespace-pre-wrap break-words">{h.content}</p></div>)}<button onClick={()=>setHistory(null)}>Close history</button></div>}<form onSubmit={submit} className="space-y-3 border-t pt-3"><label className="block text-sm">{editing?'Edit your remark':'Write a task update'}<textarea ref={input} aria-label="Write a task update" aria-autocomplete="list" aria-controls={suggestions.length?listId:undefined} aria-activedescendant={suggestions.length?`${listId}-${highlighted}`:undefined} onKeyDown={keys} onSelect={e=>setCaret(e.currentTarget.selectionStart)} value={text} disabled={readOnly||busy||Boolean(draft&&!draftStarted)} maxLength={10000} onChange={e=>{keepDraft(e.target.value);setText(e.target.value);setCaret(e.target.selectionStart);setSelected(0);setDismissed(null);setSaved(false);}} placeholder="Write an update. @ mentions · Cmd/Ctrl + Enter to post." className="mt-1 w-full rounded-lg border p-3"/></label>{suggestions.length>0&&<div id={listId} role="listbox" className="rounded-lg border p-2" aria-label="Mention suggestions">{suggestions.map((m,index)=><button role="option" id={`${listId}-${index}`} aria-selected={index===highlighted} onMouseDown={e=>e.preventDefault()} disabled={busy} key={m.id} type="button" onClick={()=>mention(m)} className={`block w-full rounded p-2 text-left text-sm hover:bg-blue-50 ${index===highlighted?'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-400':''}`}>Mention {m.full_name||m.email}</button>)}</div>}{mentions.length>0&&<div className="flex flex-wrap gap-2">{mentions.map(id=><button disabled={busy} type="button" key={id} onClick={()=>{const people=mentions.filter(x=>x!==id);keepDraft(text,people);setMentions(people);}} className="rounded-full border px-3 py-1 text-xs">@{members.find(m=>m.id===id)?.full_name||'Teammate'} ×</button>)}</div>}<button disabled={readOnly||busy||!loaded||!text.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">{busy?'Saving…':editing?'Save remark':'Post update'}</button>{editing&&<button disabled={busy} type="button" className="ml-3 text-sm" onClick={()=>{if(window.confirm('Discard this remark edit?')){clearDraft();setDraftNotice('');setEditing(null);setText('');setMentions([]);}}}>Cancel edit</button>}</form></section>;
}
