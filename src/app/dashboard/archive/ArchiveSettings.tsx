'use client';
import {useState} from 'react';
import {saveArchiveSettings} from './actions';
export default function ArchiveSettings({settings}:{settings:{tasks_enabled:boolean;projects_enabled:boolean;task_days:number;project_days:number}}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <details className="rounded-xl border bg-surface p-4"><summary className="cursor-pointer font-medium">Automatic archiving settings</summary><form className="mt-4 space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const result=await saveArchiveSettings(new FormData(e.currentTarget));setMessage(result.error||'Archiving settings saved.');}catch{setMessage('Settings could not be saved. Please retry.');}finally{setBusy(false);}}}>
 <p className="text-sm text-gray-500">Rules run every 15 minutes. Empty projects and projects with recurring tasks stay active. Restoring an item restarts its retention window. Existing completed tasks start their clock when this feature is installed.</p>
 {(['tasks','projects'] as const).map(kind=><fieldset key={kind} className="flex flex-wrap items-center gap-3"><label><input type="checkbox" name={`${kind}_enabled`} defaultChecked={settings[`${kind}_enabled`]} className="mr-2"/>Automatically archive {kind}</label><label>After <input aria-label={`${kind} retention days`} name={kind==='tasks'?'task_days':'project_days'} type="number" min="1" max="3650" defaultValue={kind==='tasks'?settings.task_days:settings.project_days} className="w-24 rounded-lg border p-2"/> days {kind==='tasks'?'completed':'with all tasks completed'}</label></fieldset>)}
 <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">{busy?'Saving…':'Save archiving settings'}</button>{message&&<p role="status">{message}</p>}
 </form></details>;
}
