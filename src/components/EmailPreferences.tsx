'use client';
import {useState} from 'react';
import {saveEmailPreferences} from '@/app/dashboard/preferences/actions';
export type EmailSettings={enabled:boolean;assignments:boolean;mentions:boolean;reviews:boolean;deadline_digest:boolean};
export default function EmailPreferences({initial,deliveryEnabled}:{initial:EmailSettings;deliveryEnabled:boolean}){
 const [value,setValue]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 return <details className="mt-4 rounded-xl border bg-surface p-4"><summary className="cursor-pointer text-sm font-medium">Email preferences</summary><form className="mt-4 space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{const result=await saveEmailPreferences(value);if(result.error)setError(result.error);else setMessage('Email preferences saved.');}catch{setError('Email preferences could not be saved.');}finally{setBusy(false);}}}>
 {!deliveryEnabled&&<p className="rounded-lg border p-3 text-sm text-gray-600">Workspace email delivery has not been enabled yet. You can save your preferences now.</p>}
 <fieldset disabled={busy} className="space-y-3"><label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={value.enabled} onChange={e=>setValue({...value,enabled:e.target.checked})}/>Receive email notifications</label>
 {(['assignments','mentions','reviews','deadline_digest'] as const).map(key=><label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value[key]} onChange={e=>setValue({...value,[key]:e.target.checked})}/>{({assignments:'New task assignments',mentions:'Mentions in task updates',reviews:'Review requests and decisions',deadline_digest:'Daily deadline summary'} as const)[key]}</label>)}</fieldset>
 <p className="text-xs leading-5 text-gray-500">Email choices are separate from in-app alerts. Deadline summaries run from 9 AM India time and include overdue work and tasks due today or tomorrow. Only new events are emailed. Open the task to reply; email replies do not update it.</p>
 <button disabled={busy} className="rounded-lg border px-4 py-2.5 text-sm">{busy?'Saving…':'Save email preferences'}</button>{message&&<p role="status" className="text-sm">{message}</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</form></details>;
}
