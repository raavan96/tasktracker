import 'server-only';
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {workspaceRead} from './workspace-data';
import {validDate,calendarRange} from './planning-types';
import type {Blueprint,PlanningSource,PlanningPreview,PlanInput} from './planning-types';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fail(message:string):never{throw new Error(message);}
export async function loadBlueprint(db:PoolClient,source:PlanningSource):Promise<PlanningPreview>{
 if(!source||!uuid.test(source.id)||!['project','task','template'].includes(source.kind))fail('Choose a project, task or template.');
 if(source.kind==='template'){
  const row=(await db.query<{source_project_id:string;blueprint:Blueprint}>('SELECT source_project_id,blueprint FROM planning_templates WHERE id=$1',[source.id])).rows[0];
  if(!row)fail('Template unavailable or source project access was removed.');
  return {source,version:digest(row),sourceProjectId:row.source_project_id,blueprint:row.blueprint};
 }
 const project=(await db.query<{id:string;name:string;description:string|null}>('SELECT id,name,description FROM projects WHERE id='+ (source.kind==='project'?'$1':'(SELECT project_id FROM tasks WHERE id=$1)'),[source.id])).rows[0];
 if(!project)fail('Source unavailable or access was removed.');
 const tasks=(await db.query<{id:string;title:string;description:string|null;priority:string;due_date:string|null}>("SELECT id,title,description,priority,due_date::text FROM tasks WHERE "+(source.kind==='task'?'id=$1':'project_id=$1 AND NOT is_archived')+' ORDER BY created_at,id LIMIT 101',[source.id])).rows;
 if(tasks.length>100)fail('A project copy supports up to 100 active tasks. Copy smaller projects or individual tasks.');
 if(source.kind==='task'&&!tasks.length)fail('Task unavailable.');
 const keys=tasks.map(t=>t.id);
 const checklist=(await db.query<{task_id:string;title:string}>('SELECT task_id,title FROM task_checklist WHERE task_id=ANY($1::uuid[]) ORDER BY created_at,id LIMIT 501',[keys])).rows;
 if(checklist.length>500)fail('A copy supports up to 500 checklist items.');
 const dependencies=(await db.query<{task_id:string;depends_on:string}>('SELECT task_id,depends_on FROM task_dependencies WHERE task_id=ANY($1::uuid[]) AND depends_on=ANY($1::uuid[]) ORDER BY task_id,depends_on',[keys])).rows;
 const earliest=tasks.map(t=>t.due_date).filter((d):d is string=>!!d).sort()[0];
 const blueprint:Blueprint={kind:source.kind,name:source.kind==='task'?tasks[0].title:project.name,description:source.kind==='task'?tasks[0].description||'':project.description||'',tasks:tasks.map(t=>({key:t.id,title:t.title,description:t.description||'',priority:t.priority,offset:t.due_date&&earliest?Math.round((Date.parse(t.due_date)-Date.parse(earliest))/86400000):null,checklist:checklist.filter(c=>c.task_id===t.id).map(c=>c.title),dependencies:dependencies.filter(d=>d.task_id===t.id).map(d=>d.depends_on)}))};
 // Include exact source deadlines: shifting all original dates still invalidates an old preview.
 return {source,version:digest({blueprint,dates:tasks.map(t=>t.due_date)}),sourceProjectId:project.id,blueprint};
}
export async function planningOptions(){return workspaceRead(async(db,user)=>({user,
 projects:(await db.query<{id:string;name:string;writable:boolean}>('SELECT id,name,can_work_project(id) writable FROM projects ORDER BY name,id')).rows,
 people:(await db.query<{id:string;full_name:string|null;email:string}>('SELECT id,full_name,email FROM profiles WHERE is_active ORDER BY full_name,id')).rows,
 memberships:(await db.query<{project_id:string;user_id:string}>('SELECT project_id,user_id FROM project_members')).rows,
 templates:(await db.query<{id:string;name:string;created_at:string;kind:string;task_count:number}>("SELECT id,name,created_at,blueprint->>'kind' kind,jsonb_array_length(blueprint->'tasks') task_count FROM planning_templates ORDER BY created_at DESC,id LIMIT 200")).rows
}));}
export async function previewPlanning(source:PlanningSource){return workspaceRead(db=>loadBlueprint(db,source));}
export async function storeTemplate(source:PlanningSource,version:string,name:string){return workspaceRead(async(db,user)=>{
 const preview=await loadBlueprint(db,source);if(preview.version!==version)fail('The source changed. Reload the preview before saving.');
 name=String(name).trim();if(!name||name.length>200)fail('Template name must be 1–200 characters.');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user+':templates']);
 if(Number((await db.query('SELECT count(*) n FROM planning_templates WHERE created_by=$1',[user])).rows[0].n)>=200)fail('You have reached 200 templates. Remove an unused template first.');
 return (await db.query<{id:string}>('INSERT INTO planning_templates(created_by,source_project_id,name,blueprint) VALUES($1,$2,$3,$4::jsonb) RETURNING id',[user,preview.sourceProjectId,name,JSON.stringify(preview.blueprint)])).rows[0];
});}
export async function removeTemplate(id:string){return workspaceRead(async(db)=>{if(!uuid.test(id))fail('Invalid template.');await db.query('DELETE FROM planning_templates WHERE id=$1',[id]);});}
export async function createPlan(input:PlanInput){return workspaceRead(async(db,user)=>{
 if(!input||!uuid.test(input.requestId)||!Array.isArray(input.tasks)||input.tasks.length>100||JSON.stringify(input).length>524288)fail('Invalid copy request.');
 const hash=digest(input);
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user+input.requestId]);
 const prior=(await db.query<{payload_hash:string;project_id:string;task_id:string|null}>('SELECT payload_hash,project_id,task_id FROM planning_requests WHERE created_by=$1 AND request_id=$2',[user,input.requestId])).rows[0];
 if(prior){if(prior.payload_hash!==hash)fail('This copy was already created. Reload before starting another copy.');return {projectId:prior.project_id,taskId:prior.task_id};}
 const preview=await loadBlueprint(db,input.source);if(preview.version!==input.version)fail('The source changed. Reload the preview and check your choices.');
 if(input.tasks.length!==preview.blueprint.tasks.length||new Set(input.tasks.map(t=>t.key)).size!==input.tasks.length||input.tasks.some(t=>!preview.blueprint.tasks.some(s=>s.key===t.key)))fail('The task list changed. Reload the preview.');
 const text=(value:unknown,max:number,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail('Check the names, descriptions and checklist items.');return value.trim();};
 const name=text(input.name,200,true),description=text(input.description,10000);
 if(!Array.isArray(input.members)||input.members.length>30||input.members.some(id=>!uuid.test(id)))fail('Choose up to 30 active members.');
 if(input.tasks.reduce((sum,t)=>sum+(Array.isArray(t.checklist)?t.checklist.length:501),0)>500)fail('A copy supports up to 500 checklist items.');
 for(const t of input.tasks){text(t.title,200,true);text(t.description,10000);if(!['low','medium','high','urgent'].includes(t.priority)||typeof t.dueDate!=='string'||(t.dueDate&&!validDate(t.dueDate)))fail('Check each priority and deadline.');if(!Array.isArray(t.assigneeIds)||t.assigneeIds.length>30||t.assigneeIds.some(id=>!uuid.test(id))||new Set(t.assigneeIds).size!==t.assigneeIds.length)fail('Check the assignees.');t.checklist.forEach(c=>text(c,300,true));}
 let projectId=input.targetProjectId;
 if(preview.blueprint.kind==='project'){
  if(input.tasks.some(t=>t.assigneeIds.some(id=>id!==user&&!input.members.includes(id))))fail('Add all assignees to the new project.');
  projectId=(await db.query<{id:string}>('SELECT create_workspace_project($1,$2,$3::uuid[],true) id',[name,description,input.members])).rows[0].id;
 }else if(!uuid.test(projectId)||!(await db.query('SELECT id FROM projects WHERE id=$1 AND can_work_project(id) FOR SHARE',[projectId])).rows.length)fail('Choose an active project you can work in.');
 const ids=new Map<string,string>();
 for(const t of input.tasks){const row=(await db.query<{id:string}>("INSERT INTO tasks(project_id,title,description,priority,due_date,assignee_ids,created_by,status,recurrence) VALUES($1,$2,$3,$4,$5,$6::uuid[],$7,'todo','none') RETURNING id",[projectId,preview.blueprint.kind==='task'?name:t.title.trim(),preview.blueprint.kind==='task'?description:t.description.trim(),t.priority,t.dueDate||null,t.assigneeIds,user])).rows[0];ids.set(t.key,row.id);
  if(t.checklist.length)await db.query('INSERT INTO task_checklist(task_id,title,completed) SELECT $1,item,false FROM unnest($2::text[]) item',[row.id,t.checklist.map(c=>c.trim())]);
 }
 for(const task of preview.blueprint.tasks)for(const dependency of task.dependencies)await db.query('INSERT INTO task_dependencies(task_id,depends_on) VALUES($1,$2)',[ids.get(task.key),ids.get(dependency)]);
 const taskId=preview.blueprint.kind==='task'?ids.values().next().value||null:null;
 await db.query('INSERT INTO planning_requests(created_by,request_id,payload_hash,project_id,task_id) VALUES($1,$2,$3,$4,$5)',[user,input.requestId,hash,projectId,taskId]);
 return {projectId,taskId};
});}
export async function calendarData(date:string,mode:string,project:string,assignee:string){const range=calendarRange(date,mode);if(project&&!uuid.test(project)||assignee&&!uuid.test(assignee))fail('Choose a valid project or member.');return workspaceRead(async db=>{
 const filter=' FROM tasks t JOIN projects p ON p.id=t.project_id WHERE NOT t.is_archived AND NOT p.is_archived AND ($1::uuid IS NULL OR t.project_id=$1) AND ($2::uuid IS NULL OR $2=ANY(t.assignee_ids))';
 const args=[project||null,assignee||null,range.from,range.to];
 const total=Number((await db.query('SELECT count(*) n'+filter+' AND t.due_date BETWEEN $3::date AND $4::date',args)).rows[0].n);
 const items=(await db.query<{id:string;project_id:string;title:string;project_name:string;status:string;due_date:string;assignees:string}>("SELECT t.id,t.project_id,t.title,p.name project_name,t.status,t.due_date::text,(SELECT string_agg(coalesce(m.full_name,m.email),', ' ORDER BY m.full_name,m.id) FROM profiles m WHERE m.id=ANY(t.assignee_ids)) assignees"+filter+' AND t.due_date BETWEEN $3::date AND $4::date ORDER BY t.due_date,t.title,t.id LIMIT 500',args)).rows;
 const undated=Number((await db.query('SELECT count(*) n'+filter+' AND t.due_date IS NULL',args.slice(0,2))).rows[0].n);
 return {items,total,undated,...range};
});}
