export type SavedTaskView={id:string;name:string;filters:Record<string,string>};
const enums:Record<string,string[]>={summary:['all','undated','pending','blocked','overdue','today','in_progress','in_review','done'],sort:['deadline','title','priority','assignee'],priority:['all','low','medium','high','urgent'],status:['all','todo','in_progress','blocked','in_review','done'],preset:['all','delegated','review','stale'],mine:['true','false'],creator:['on','off']};
export function cleanView(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid view filters.');
 const result:Record<string,string>={};
 for(const [key,value] of Object.entries(input)){
  if(typeof value!=='string')continue;
  if(enums[key]?.includes(value))result[key]=value;
  else if(key==='q')result.q=value.slice(0,200);
  else if(['project','assignee'].includes(key)&&(value===''||value==='all'||(key==='assignee'&&value==='unassigned')||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)))result[key]=value;
 }
 return result;
}
export function activityLabel(last:string|undefined,today:string,status:string){
 if(!last||!Number.isFinite(Date.parse(last))||status==='done')return null;const days=Math.floor((Date.parse(today)-Date.parse(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(last))))/86400000);
 return days>=7?`No update for ${days} days`:null;
}

// Display preferences and route context are intentionally separate from task filters.
export function clearTaskFilterParams(input:URLSearchParams){
 const result=new URLSearchParams(input);
 for(const key of ['q','summary','assignee','sort','priority','project','status','preset','mine','page'])result.delete(key);
 return result;
}
export function activeTaskFilterChips(filters:Record<string,string>,context:{mine?:boolean;projectId?:string;people?:Record<string,string>;projects?:Record<string,string>}={}){
 const chips:{key:string;label:string}[]=[];
 const labels:Record<string,string>={undated:'No deadline',pending:'Pending',blocked:'Blocked',overdue:'Overdue',today:'Due today',in_progress:'In progress',in_review:'Awaiting review',done:'Completed',todo:'To do',delegated:'Delegated by me',review:'My reviews',stale:'No recent updates'};
 if(filters.q?.trim())chips.push({key:'q',label:`Search: ${filters.q}`});
 if(filters.preset&&filters.preset!=='all')chips.push({key:'preset',label:`View: ${labels[filters.preset]||filters.preset}`});
 if(filters.mine==='true'&&!context.mine)chips.push({key:'mine',label:'Assigned to me'});
 if(filters.summary&&filters.summary!=='all')chips.push({key:'summary',label:labels[filters.summary]||filters.summary});
 if(filters.status&&filters.status!=='all')chips.push({key:'status',label:`Status: ${labels[filters.status]||filters.status}`});
 if(filters.assignee&&filters.assignee!=='all')chips.push({key:'assignee',label:filters.assignee==='unassigned'?'Unassigned':`${context.mine||filters.mine==='true'?'Also assigned to':'Assignee'}: ${context.people?.[filters.assignee]||'Selected teammate'}`});
 if(filters.priority&&filters.priority!=='all')chips.push({key:'priority',label:`Priority: ${filters.priority}`});
 if(filters.project&&!context.projectId)chips.push({key:'project',label:`Project: ${context.projects?.[filters.project]||'Selected project'}`});
 return chips;
}
