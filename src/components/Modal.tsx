'use client';
import {useEffect,useId,useRef,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
const subscribe=()=>()=>{};
type Field=HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
function fieldValue(field:Field){if(field instanceof HTMLInputElement){if(field.type==='checkbox'||field.type==='radio')return String(field.checked);if(field.type==='file')return [...(field.files||[])].map(f=>`${f.name}:${f.size}:${f.lastModified}`).join('|');}return field.value;}
function defaultValue(field:Field){if(field instanceof HTMLInputElement&&(field.type==='checkbox'||field.type==='radio'))return String(field.defaultChecked);if(field instanceof HTMLSelectElement)return [...field.options].find(o=>o.defaultSelected)?.value||field.options[0]?.value||'';return (field as HTMLInputElement).defaultValue;}
export default function Modal({title,onClose,busy=false,side=false,className='',children}:{title:string;onClose:()=>void;busy?:boolean;side?:boolean;className?:string;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);const headingId=useId();const originals=useRef(new WeakMap<Field,string>());const changed=useRef(new WeakSet<Field>());
 const mounted=useSyncExternalStore(subscribe,()=>true,()=>false);
 function remember(target:EventTarget){if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement){if(!changed.current.has(target))originals.current.set(target,fieldValue(target));}}
 function edited(target:EventTarget){if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement)changed.current.add(target);}
 function dirty(){return [...(ref.current?.querySelectorAll<Field>('form input, form textarea, form select')||[])].some(field=>changed.current.has(field)&&!field.closest('[data-instant-save]')&&fieldValue(field)!==(originals.current.get(field)??defaultValue(field)));}
 function close(){if(!busy&&(!dirty()||window.confirm('Discard your unsaved changes?')))onClose();}
 useEffect(()=>{if(!mounted)return;const dialog=ref.current;const previous=document.body.style.overflow;
 dialog?.querySelectorAll<Field>('input,textarea,select').forEach(field=>originals.current.set(field,fieldValue(field)));
 dialog?.showModal();document.body.style.overflow='hidden';return()=>{dialog?.close();document.body.style.overflow=previous;};},[mounted]);
 if(!mounted)return null;
 return createPortal(<dialog ref={ref} className={`task-dialog ${side?'task-drawer':''} ${className}`} aria-labelledby={headingId} onFocusCapture={e=>remember(e.target)} onPointerDownCapture={e=>remember(e.target)} onChangeCapture={e=>edited(e.target)}
 onClick={e=>{if(e.target===ref.current){const box=ref.current.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)close();}}}
 onCancel={e=>{e.preventDefault();close();}}>
 <div className="dialog-heading mb-5 flex items-start justify-between gap-4"><h2 id={headingId} className="text-xl font-semibold break-words min-w-0">{title}</h2><button type="button" disabled={busy} onClick={close} aria-label="Close dialog" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
 <div className="dialog-content">{children}</div></dialog>,document.body);
}
