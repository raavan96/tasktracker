// Worker logic is isolated from the CLI so PostgreSQL tests can exercise it.
import {dailyBriefingData,renderDailyBriefing} from './daily.mjs';
import {weeklyReportData} from './weekly.mjs';
import {renderEmail} from './templates.mjs';
export async function claimEmail(db) {
 return (await db.query(`UPDATE email_queue SET state='attempting',attempted_at=now()
 WHERE id=(SELECT id FROM email_queue WHERE state='pending' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
 RETURNING *`)).rows[0]||null;
}
export async function prepareEmail(db,job) {
 const person=(await db.query(`SELECT u.email,p.full_name,p.role,e.* FROM email_preferences e JOIN profiles p ON p.id=e.user_id JOIN auth.users u ON u.id=p.id WHERE e.user_id=$1 AND e.enabled AND p.is_active AND NOT u.disabled AND EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled)`,[job.user_id])).rows[0];
 if(!person)return null;
 const group=['assignment','project_assignment','task_accepted'].includes(job.category)?'assignments':job.category==='mention'?'mentions':job.category==='deadline_digest'?'deadline_digest':job.category==='weekly_report'?'weekly_report':'reviews';
 if(!person[group])return null;
 const date=(await db.query("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text today")).rows[0].today;
 let data={name:person.full_name||'there'};
 if(job.category==='project_assignment'){
  if(Date.now()-new Date(job.created_at).getTime()>86400000)return null;
  const project=(await db.query('SELECT p.id,p.name FROM projects p WHERE p.id=$1 AND can_email_project($2,p.id)',[job.project_id,job.user_id])).rows[0];
  if(!project)return null;
  data={...data,projectId:project.id,projectName:project.name};
 } else if(job.category==='weekly_report'){
  const week=(await db.query("SELECT date_trunc('week',now() AT TIME ZONE 'Asia/Kolkata')::date::text week")).rows[0].week;
  if(job.event_key!==`weekly:${job.user_id}:${week}`)return null;
  const report=await weeklyReportData(db,job.user_id,week);if(!report)return null;
  data={...data,...report};
 } else if(job.category==='deadline_digest'){
  if(![`deadline:${job.user_id}:${date}`,`deadline-launch:${job.user_id}:${date}`].includes(job.event_key))return null;
  const report=await dailyBriefingData(db,job.user_id,date);if(!report)return null;
  return {recipient:person.email,...renderDailyBriefing({...data,...report})};
 } else {
  if(Date.now()-new Date(job.created_at).getTime()>86400000)return null;
  const t=(await db.query(`SELECT t.*,p.name project_name,(SELECT string_agg(coalesce(u.full_name,u.email),', ' ORDER BY u.full_name,u.id) FROM profiles u WHERE u.id=ANY(t.assignee_ids)) assignee_names FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=$1 AND can_email_task($2,t.id)`,[job.task_id,job.user_id])).rows[0];
  if(!t)return null;
  if(['assignment','approved','changes_requested','review_updated'].includes(job.category)&&!t.assignee_ids.includes(job.user_id))return null;
  if(job.category==='review_requested'){
   if(t.status!=='in_review'||t.assignee_ids.includes(job.user_id))return null;
   const policy=(await db.query('SELECT enabled FROM review_settings WHERE id')).rows[0]?.enabled;
   if(person.role!=='admin'&&(!policy||t.created_by!==job.user_id||!(await db.query('SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[t.project_id,job.user_id])).rows.length))return null;
  }
  if(job.category==='approved'&&t.status!=='done')return null;
  if(job.category==='changes_requested'&&t.status!=='in_progress')return null;
  if(job.category==='assignment'&&(await db.query("SELECT to_regclass('public.task_acknowledgements') present")).rows[0].present){
   const receipt=(await db.query('SELECT id,accepted_at FROM task_acknowledgements WHERE task_id=$1 AND user_id=$2',[t.id,job.user_id])).rows[0];
   if(!receipt||receipt.accepted_at||t.status==='done')return null;
   data.acknowledgementId=receipt.id;
   data.actor=(await db.query('SELECT coalesce(full_name,email) name FROM profiles WHERE id=$1',[t.created_by])).rows[0]?.name;
  }
  if(job.category==='task_accepted'){
   if(t.created_by!==job.user_id)return null;
   const receipt=(await db.query('SELECT a.*,coalesce(p.full_name,p.email) name FROM task_acknowledgements a JOIN profiles p ON p.id=a.user_id WHERE a.id=$1 AND a.task_id=$2 AND a.accepted_at IS NOT NULL',[job.acknowledgement_id,t.id])).rows[0];
   if(!receipt||!t.assignee_ids.includes(receipt.user_id))return null;
   const counts=(await db.query('SELECT count(*) total,count(accepted_at) accepted FROM task_acknowledgements WHERE task_id=$1',[t.id])).rows[0];
   data.actor=receipt.name;data.acceptedAt=new Date(receipt.accepted_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});data.acknowledgements=`${counts.accepted} of ${counts.total} accepted`;
  }
  data={...data,task:{id:t.id,projectId:t.project_id,title:t.title,remarkId:job.category==='mention'?job.event_key?.match(/^notice:mention:([0-9a-f-]{36}):/i)?.[1]:undefined},projectName:t.project_name,assignees:t.assignee_names,deadline:t.due_date?String(t.due_date).slice(0,10):'No deadline',note:job.category==='assignment'?undefined:job.note};
 }
 return {recipient:person.email,...renderEmail(job.category,data)};
}
export async function processOneEmail(db,send) {
 const job=await claimEmail(db);if(!job)return false;
 try {
  const prepared=await prepareEmail(db,job);
  if(!prepared){await db.query("UPDATE email_queue SET state='cancelled',finished_at=now() WHERE id=$1",[job.id]);return true;}
  const result=await send(prepared);
  // false has delivered mail in this account. It is NOT a retryable rejection.
  const accepted=result.httpStatus>=200&&result.httpStatus<300&&Array.isArray(result.body?.success)&&result.body.success.length===1&&result.body.success[0]===true;
  await db.query("UPDATE email_queue SET state=$2,http_status=$3,finished_at=now() WHERE id=$1",[job.id,accepted?'accepted':'unconfirmed',result.httpStatus]);
 } catch {
  await db.query("UPDATE email_queue SET state='unconfirmed',finished_at=now() WHERE id=$1",[job.id]);
 }
 return true;
}
