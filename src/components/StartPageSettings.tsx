'use client';
import {useState} from 'react';
import {House} from 'lucide-react';
import Modal from './Modal';
import {landingPages} from '@/lib/workspace-preferences';
import {saveStartPage} from '@/app/dashboard/preferences/actions';
export default function StartPageSettings({initial}:{initial:string}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(initial),[saved,setSaved]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <><button type="button" onClick={()=>{setValue(saved);setError('');setOpen(true);}} className="flex min-h-11 items-center gap-2 rounded-lg p-2 text-sm"><House className="h-4 w-4" aria-hidden="true"/>Start page</button>{open&&<Modal title="Your start page" busy={busy} onClose={()=>setOpen(false)}><p className="mb-4 text-sm text-gray-500">Choose where you arrive after signing in. This applies to your account on every device. Task acceptance links still open the assigned task.</p><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await saveStartPage(value);if(r.error)setError(r.error);else{setSaved(value);setOpen(false);}}catch{setError('Start page could not be saved. Please retry.');}finally{setBusy(false);}}}><label className="block text-sm">Start page<select aria-label="Start page" className="mt-2 block w-full rounded-lg border p-3" value={value} onChange={e=>setValue(e.target.value)}>{landingPages.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy} className="rounded-full border px-4 py-2 text-sm">{busy?'Saving…':'Save start page'}</button></form></Modal>}</>;
}
