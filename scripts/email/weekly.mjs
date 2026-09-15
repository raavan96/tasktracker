// Personal weekly reports never inherit an admin's workspace-wide visibility.
export async function weeklyReportData(db,userId,weekStart) {
 const {rows}=await db.query(`WITH bounds AS (
 SELECT $2::date finish,($2::date-7) start,(now() AT TIME ZONE 'Asia/Kolkata')::date today
 ), scope AS MATERIALIZED (
 SELECT p.* FROM projects p CROSS JOIN bounds b
 WHERE EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1)
 AND (NOT p.is_archived OR (p.completed_at>=b.start::timestamp AT TIME ZONE 'Asia/Kolkata' AND p.completed_at<b.finish::timestamp AT TIME ZONE 'Asia/Kolkata'))
 ), personal AS MATERIALIZED (
 SELECT t.*,p.name project_name,p.is_archived project_archived FROM tasks t JOIN scope p ON p.id=t.project_id WHERE $1=ANY(t.assignee_ids) OR t.created_by=$1
 ), completions AS MATERIALIZED (
 SELECT DISTINCT c.task_id,c.project_id,($1=ANY(c.assignee_ids) OR t.created_by=$1) mine FROM completion_events c JOIN scope p ON p.id=c.project_id JOIN tasks t ON t.id=c.task_id CROSS JOIN bounds b
 WHERE c.occurred_at>=b.start::timestamp AT TIME ZONE 'Asia/Kolkata' AND c.occurred_at<b.finish::timestamp AT TIME ZONE 'Asia/Kolkata'
 ) SELECT
 (SELECT count(*) FROM scope)::int project_count,
 (SELECT count(*) FROM completions WHERE mine)::int completed,
 (SELECT count(*) FROM personal WHERE NOT is_archived AND NOT project_archived AND status<>'done')::int pending,
 (SELECT count(*) FROM personal,bounds WHERE NOT is_archived AND NOT project_archived AND status NOT IN ('done','in_review') AND due_date<today)::int overdue,
 (SELECT count(*) FROM personal WHERE NOT is_archived AND NOT project_archived AND status='in_review')::int review,
 coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name,x.id) FROM (
 SELECT p.id,p.name,p.is_archived,
 (SELECT count(*) FROM tasks t WHERE t.project_id=p.id AND NOT t.is_archived AND NOT p.is_archived AND t.status<>'done')::int pending,
 (SELECT count(*) FROM tasks t,bounds WHERE t.project_id=p.id AND NOT t.is_archived AND NOT p.is_archived AND t.status NOT IN ('done','in_review') AND t.due_date<today)::int overdue,
 (SELECT count(*) FROM completions c WHERE c.project_id=p.id)::int completed
 FROM scope p ORDER BY p.name,p.id LIMIT 20) x),'[]'::jsonb) projects,
 coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.due_date NULLS LAST,x.id) FROM (
 SELECT t.id,t.project_id,t.title,t.project_name,t.status,t.due_date::text due_date FROM personal t WHERE NOT t.is_archived AND NOT t.project_archived AND t.status<>'done' ORDER BY t.due_date NULLS LAST,t.id LIMIT 10) x),'[]'::jsonb) tasks`,[userId,weekStart]);
 const r=rows[0];if(!r?.project_count)return null;
 const start=new Date(weekStart+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-7);
 const end=new Date(weekStart+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);
 const format=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return {period:`${format(start)} – ${format(end)}`,stats:[{label:'Your tasks completed last week',value:r.completed},{label:'Your pending tasks now',value:r.pending},{label:'Your overdue tasks now',value:r.overdue},{label:'Your tasks awaiting review now',value:r.review}],itemsTitle:'Your pending tasks',items:r.tasks.map(t=>({title:t.title,detail:`${t.project_name} · ${t.status==='in_review'?'Awaiting review':t.status.replaceAll('_',' ')} · ${t.due_date?'Due '+t.due_date:'No deadline'}`,task:{id:t.id,projectId:t.project_id}})),moreCount:Math.max(0,r.pending-r.tasks.length),projects:r.projects.map(p=>({id:p.id,name:p.name,detail:`${p.completed} completed last week · ${p.pending} pending now · ${p.overdue} overdue now${p.is_archived?' · Completed project':''}`})),moreProjects:Math.max(0,r.project_count-r.projects.length)};
}
