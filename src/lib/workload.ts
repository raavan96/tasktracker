import {assignedIds} from './task-types';
import {matchesSummary} from './task-presentation';
export type WorkloadTask={id:string;project_id:string;title:string;status:string;due_date:string|null;assignee_id?:string|null;assignee_ids?:string[];project:{name:string}|null};
export type WorkloadPerson={id:string;full_name:string|null;email:string;is_active?:boolean};
export const workloadStatuses=[{id:'todo',label:'To do'},{id:'in_progress',label:'In progress'},{id:'in_review',label:'In review'},{id:'blocked',label:'Blocked'}] as const;
export function workloadModel(people:WorkloadPerson[],tasks:WorkloadTask[],today:string){
 const unique=[...new Map(tasks.map(t=>[t.id,t])).values()];
 const count=(items:WorkloadTask[])=>({pending:items.filter(t=>t.status!=='done').length,overdue:items.filter(t=>matchesSummary(t,'overdue',today)).length,in_review:items.filter(t=>t.status==='in_review').length,done:items.filter(t=>t.status==='done').length,blocked:items.filter(t=>t.status==='blocked').length});
 const rows=[...people.map(p=>({id:p.id,name:p.full_name||p.email,active:p.is_active!==false})),{id:'unassigned',name:'Unassigned',active:true}].map(p=>{
  const items=unique.filter(t=>p.id==='unassigned'?!assignedIds(t).length:assignedIds(t).includes(p.id));
  const pending=items.filter(t=>t.status!=='done').sort((a,b)=>Number(matchesSummary(b,'overdue',today))-Number(matchesSummary(a,'overdue',today))||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
  return {...p,...count(items),segments:workloadStatuses.map(s=>pending.filter(t=>t.status===s.id).length),tasks:pending};
 }).sort((a,b)=>b.pending-a.pending||b.overdue-a.overdue||a.name.localeCompare(b.name));
 return {rows,summary:{...count(unique),unassigned:unique.filter(t=>t.status!=='done'&&!assignedIds(t).length).length},axisMax:Math.max(5,Math.ceil(Math.max(0,...rows.map(p=>p.pending))/5)*5)};
}
export type WorkloadModel=ReturnType<typeof workloadModel>;
