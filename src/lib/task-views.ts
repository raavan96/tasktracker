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
