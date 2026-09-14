'use client';
import {useState} from 'react';
import type {Member} from '@/lib/task-types';
export default function AssigneePicker({members,initial=[],name='assigneeIds'}:{members:Member[];initial?:string[];name?:string}){
 const [selected,setSelected]=useState(initial),[query,setQuery]=useState('');
 const choices=[...members,...selected.filter(id=>!members.some(m=>m.id===id)).map(id=>({id,full_name:'Former / inactive assignee',email:'',is_active:false}))];
 const visible=choices.filter(m=>`${m.full_name||''} ${m.email}`.toLowerCase().includes(query.toLowerCase()));
 return <fieldset className="space-y-2"><legend className="text-sm font-medium">Assignees</legend><input type="hidden" name={name} value={JSON.stringify(selected)}/><input aria-label="Search assignees" placeholder="Search project members…" value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm"/><div className="max-h-40 overflow-y-auto rounded-lg border p-2">{visible.map(m=><label key={m.id} className="flex items-center gap-2 rounded p-2 text-sm"><input type="checkbox" checked={selected.includes(m.id)} disabled={m.is_active===false&&!selected.includes(m.id)} onChange={e=>setSelected(e.target.checked?[...selected,m.id]:selected.filter(id=>id!==m.id))}/>{m.full_name||m.email}{m.is_active===false?' · Inactive':''}</label>)}{!visible.length&&<p className="p-2 text-sm text-gray-500">No matching project members.</p>}</div><p className="text-xs text-gray-500">{selected.length?`${selected.length} selected · One shared status and approval`:'Unassigned'}</p></fieldset>;
}
