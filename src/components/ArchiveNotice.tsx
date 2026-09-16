'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {changeArchive} from '@/app/dashboard/archive/actions';
type Notice={kind:'project'|'task';id:string};
export default function ArchiveNotice(){
 const [notice,setNotice]=useState<Notice|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 useEffect(()=>{const receive=(event:Event)=>{setNotice((event as CustomEvent<Notice>).detail);setError('');};window.addEventListener('tasktracker:archived',receive);return()=>window.removeEventListener('tasktracker:archived',receive);},[]);
 useEffect(()=>{if(!notice||busy||error)return;const timer=window.setTimeout(()=>setNotice(current=>current===notice?null:current),10000);return()=>window.clearTimeout(timer);},[notice,busy,error]);
 if(!notice)return null;
 return <div role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg flex-wrap items-center gap-3 rounded-xl border bg-surface p-4 shadow-xl"><span>{error||`${notice.kind==='project'?'Project':'Task'} moved to the archive.`}</span><button disabled={busy} className="underline" onClick={async()=>{setBusy(true);try{const result=await changeArchive(notice.kind,notice.id,false);if(result.error)setError(result.error);else{setNotice(null);router.refresh();}}catch{setError('Could not undo. Restore from Archive.');}finally{setBusy(false);}}}>Undo</button><button disabled={busy} aria-label="Dismiss archive notification" className="ml-auto px-2" onClick={()=>setNotice(null)}>×</button></div>;
}
