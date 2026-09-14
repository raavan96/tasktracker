'use client';
import {useState} from 'react';
import Modal from './Modal';
export default function AttachmentPreview({id,name}:{id:string;name:string}){
 const [mime,setMime]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function open(){setBusy(true);setError('');try{const r=await fetch('/api/attachments/'+id+'?info=1');if(!r.ok)throw new Error();const data=await r.json();if(!data.mime){setError('This file is download-only.');return;}setMime(data.mime);}catch{setError('Preview unavailable. Try downloading the file.');}finally{setBusy(false);}}
 return <><button className="rounded-lg border px-3 py-2 text-xs" disabled={busy} onClick={open}>Preview {name}</button>{error&&<p role="status" className="text-xs text-gray-500">{error}</p>}{mime&&<Modal title={name} onClose={()=>setMime('')}><a href={'/api/attachments/'+id} className="mb-3 inline-block rounded-lg border p-2 text-sm">Download file</a><p className="mb-3 text-xs text-gray-500">If your browser cannot display this file, use Download file.</p>{mime==='application/pdf'?<iframe title={'Preview '+name} sandbox="" src={'/api/attachments/'+id+'?preview=1'} className="h-[65dvh] w-full rounded-lg border"/>:
 // The preview endpoint requires the browser's session cookie; do not proxy it through an image optimizer.
 // eslint-disable-next-line @next/next/no-img-element
 <img alt={name} src={'/api/attachments/'+id+'?preview=1'} onError={()=>setError('The image could not be displayed.')} className="max-h-[65dvh] w-full object-contain"/>}</Modal>}</>;
}
