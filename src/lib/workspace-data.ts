import 'server-only';
import {currentUser} from './postgres/auth';
import {transaction} from './postgres/db';
import type {PoolClient} from 'pg';
import type {TableTask} from '@/components/TaskTable';
export async function workspaceRead<T>(work:(db:PoolClient,userId:string)=>Promise<T>){const user=await currentUser();if(!user)throw new Error('Please sign in again.');return transaction(user.id,async db=>{await db.query('SELECT public.assert_active()');return work(db,user.id);});}
export type TaskFilters={q?:string;summary?:string;assignee?:string;sort?:string;project?:string;page?:number;archived?:boolean;mine?:boolean;status?:string;priority?:string};
export async function taskPage(filters:TaskFilters,exportAll=false){return workspaceRead(async(db,user)=>{
 const args:unknown[]=[];const bind=(v:unknown)=>{args.push(v);return '$'+args.length;};
 const where=[filters.archived?'(t.is_archived OR p.is_archived)':'NOT t.is_archived AND NOT p.is_archived'];
 if(filters.project)where.push('t.project_id='+bind(filters.project)+'::uuid');
 if(filters.mine)where.push(bind(user)+'::uuid=ANY(t.assignee_ids)');
 if(filters.assignee&&filters.assignee!=='all')where.push(filters.assignee==='unassigned'?'cardinality(t.assignee_ids)=0':bind(filters.assignee)+'::uuid=ANY(t.assignee_ids)');
 if(filters.q?.trim())where.push("concat_ws(' ',t.title,t.description,a.full_name,a.email,c.full_name,c.email,p.name) ILIKE "+bind('%'+filters.q.trim().slice(0,200).replace(/[\\%_]/g,'\\$&')+'%'));
 const today="(now() AT TIME ZONE 'Asia/Kolkata')::date";
 const summaries:Record<string,string>={pending:"t.status<>'done'",overdue:`t.status NOT IN ('done','in_review') AND t.due_date<${today}`,today:`t.status NOT IN ('done','in_review') AND t.due_date=${today}`,in_progress:"t.status='in_progress'",in_review:"t.status='in_review'",done:"t.status='done'",blocked:"t.status='blocked'"};
 if(filters.summary&&summaries[filters.summary])where.push(summaries[filters.summary]);
 if(filters.status&&filters.status!=='all')where.push('t.status::text='+bind(filters.status));
 if(filters.priority&&filters.priority!=='all')where.push('t.priority::text='+bind(filters.priority));
 const from=` FROM tasks t JOIN projects p ON p.id=t.project_id LEFT JOIN LATERAL (SELECT string_agg(coalesce(m.full_name,m.email),', ' ORDER BY m.full_name,m.id) full_name,string_agg(m.email,' ' ORDER BY m.id) email,bool_and(m.is_active) is_active FROM profiles m WHERE m.id=ANY(t.assignee_ids)) a ON true LEFT JOIN profiles c ON c.id=t.created_by WHERE `+where.join(' AND ');
 const total=Number((await db.query<{n:string}>('SELECT count(*) n'+from,args)).rows[0].n);
 if(exportAll&&total>10000)throw new Error('This export exceeds 10,000 rows. Narrow the filters first.');
 const page=Math.min(Math.max(1,Math.trunc(Number(filters.page)||1)),Math.max(1,Math.ceil(total/25)));
 const sorts:Record<string,string>={deadline:'t.due_date ASC NULLS LAST',title:'lower(t.title)',assignee:"lower(coalesce(a.full_name,a.email,''))",priority:"CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"};
 const items=(await db.query<TableTask & {review_version:number;description:string|null}>("SELECT t.id,t.project_id,t.title,t.status,t.priority,t.description,t.due_date,t.assignee_id,t.assignee_ids,t.review_version,jsonb_build_object('full_name',a.full_name,'email',a.email,'is_active',a.is_active) assignee,jsonb_build_object('full_name',c.full_name,'email',c.email) creator,jsonb_build_object('name',p.name) project"+from+' ORDER BY '+(sorts[filters.sort||'deadline']||sorts.deadline)+',t.id LIMIT '+(exportAll?10000:25)+' OFFSET '+(exportAll?0:(page-1)*25),args)).rows;
 const people=(await db.query<{id:string;full_name:string|null;email:string}>('SELECT id,full_name,email FROM profiles ORDER BY full_name,id')).rows;
 const projects=(await db.query<{id:string;name:string}>('SELECT id,name FROM projects ORDER BY name,id')).rows;
 return {items,total,page,people,projects};
});}
export async function searchWorkspace(query:string,archived:boolean,page=1){return workspaceRead(async db=>{
 const q=query.trim().slice(0,200);if(!q)return {items:[],total:0,page:1};
 const from=` FROM (
 SELECT 'Project' kind,p.id,p.id project_id,p.name title,p.description body,p.name project_name,p.is_archived archived,'/dashboard/projects/'||p.id url,to_tsvector('simple',coalesce(p.name,'')||' '||coalesce(p.description,'')) document FROM projects p
 UNION ALL SELECT 'Task',t.id,t.project_id,t.title,t.description,p.name,(t.is_archived OR p.is_archived),'/dashboard/projects/'||p.id||'?task='||t.id,to_tsvector('simple',coalesce(t.title,'')||' '||coalesce(t.description,'')) FROM tasks t JOIN projects p ON p.id=t.project_id
 UNION ALL SELECT 'Project note',n.id,n.project_id,n.title,n.content,p.name,p.is_archived,'/dashboard/projects/'||p.id||'?tab=notes#note-'||n.id,to_tsvector('simple',n.title||' '||n.content) FROM project_notes n JOIN projects p ON p.id=n.project_id
 UNION ALL SELECT 'Task remark',c.id,t.project_id,t.title,c.content,p.name,(p.is_archived OR t.is_archived),'/dashboard/projects/'||p.id||'?task='||t.id||'&discussion=true',to_tsvector('simple',c.content) FROM task_comments c JOIN tasks t ON t.id=c.task_id JOIN projects p ON p.id=t.project_id
 ) results WHERE document @@ websearch_to_tsquery('simple',$1) AND ($2::boolean OR NOT archived)`;
 const total=Number((await db.query<{n:string}>('SELECT count(*) n'+from,[q,archived])).rows[0].n);page=Math.min(Math.max(1,Math.trunc(Number(page)||1)),Math.max(1,Math.ceil(total/25)));
 const items=(await db.query<{kind:string;id:string;title:string;body:string;project_name:string;archived:boolean;url:string}>("SELECT kind,id,title,left(body,220) body,project_name,archived,url"+from+' ORDER BY kind,lower(title),id LIMIT 25 OFFSET $3',[q,archived,(page-1)*25])).rows;
 return {items,total,page};
});}
export type ReportFilters={from:string;to:string;project?:string;assignee?:string;scope?:string;page?:number};
export async function reportData(f:ReportFilters,exportAll=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f.from)||!/^\d{4}-\d{2}-\d{2}$/.test(f.to)||!Number.isFinite(Date.parse(f.from))||!Number.isFinite(Date.parse(f.to))||f.from>f.to||Date.parse(f.to)-Date.parse(f.from)>3660*86400000)throw new Error('Choose a valid date range of up to 10 years.');
 return workspaceRead(async db=>{
 const args:unknown[]=[f.from,f.to,f.project||null,f.assignee||null,f.scope!=='active'];
 const where=" WHERE e.occurred_at>=($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND e.occurred_at<(($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata') AND ($3::uuid IS NULL OR e.project_id=$3::uuid) AND ($4::uuid IS NULL OR $4::uuid=ANY(e.assignee_ids)) AND ($5::boolean OR (NOT t.is_archived AND NOT p.is_archived))";
 const from=` FROM completion_events e JOIN tasks t ON t.id=e.task_id JOIN projects p ON p.id=e.project_id LEFT JOIN LATERAL (SELECT string_agg(coalesce(m.full_name,m.email),', ' ORDER BY m.full_name,m.id) full_name,NULL::text email FROM profiles m WHERE m.id=ANY(e.assignee_ids)) a ON true`;
 const summary=(await db.query<{tasks:string;events:string;on_time:string;late:string;unknown:string}>(`SELECT count(DISTINCT e.task_id) tasks,count(*) events,count(*) FILTER(WHERE e.due_date IS NOT NULL AND (e.occurred_at AT TIME ZONE 'Asia/Kolkata')::date<=e.due_date) on_time,count(*) FILTER(WHERE e.due_date IS NOT NULL AND (e.occurred_at AT TIME ZONE 'Asia/Kolkata')::date>e.due_date) late,count(*) FILTER(WHERE e.due_date IS NULL) unknown`+from+where,args)).rows[0];
 const total=Number(summary.events);if(exportAll&&total>10000)throw new Error('Export exceeds 10,000 events. Narrow the date range or filters.');const page=Math.min(Math.max(1,Math.trunc(Number(f.page)||1)),Math.max(1,Math.ceil(total/25)));
 const items=(await db.query<{id:string;task_id:string;project_id:string;task_title:string;project_name:string;assignee:string|null;due_date:string|null;occurred_at:string;source:string;archived:boolean}>("SELECT e.id,e.task_id,e.project_id,e.task_title,p.name project_name,coalesce(a.full_name,a.email) assignee,e.due_date,e.occurred_at,e.source,(t.is_archived OR p.is_archived) archived"+from+where+' ORDER BY e.occurred_at DESC,e.id LIMIT '+(exportAll?10000:25)+' OFFSET '+(exportAll?0:(page-1)*25),args)).rows;
 const trend=(await db.query<{day:string;events:string}>("SELECT date_trunc('week',e.occurred_at AT TIME ZONE 'Asia/Kolkata')::date::text AS day,count(*) events"+from+where+' GROUP BY 1 ORDER BY 1',args)).rows;
 const overdue=Number((await db.query<{n:string}>("SELECT count(*) n FROM tasks t JOIN projects p ON p.id=t.project_id WHERE NOT t.is_archived AND NOT p.is_archived AND t.status NOT IN ('done','in_review') AND t.due_date<(now() AT TIME ZONE 'Asia/Kolkata')::date AND ($1::uuid IS NULL OR t.project_id=$1::uuid) AND ($2::uuid IS NULL OR $2::uuid=ANY(t.assignee_ids))",[f.project||null,f.assignee||null])).rows[0].n);
 const projects=(await db.query<{id:string;name:string}>('SELECT id,name FROM projects ORDER BY name,id')).rows;const people=(await db.query<{id:string;full_name:string|null;email:string}>('SELECT id,full_name,email FROM profiles ORDER BY full_name,id')).rows;
 return {summary,items,trend,overdue,projects,people,page,total};
 });
}
