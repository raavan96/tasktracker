import 'server-only';
import { workspaceRead } from './workspace-data';
import { todayKey } from './task-presentation';
export type InsightProject={id:string;name:string;creator:string;is_archived:boolean;completed_at:string|null;total:number;done:number;attention:boolean};
export type DashboardInsights={today:string;month:string;isAdmin:boolean;projects:InsightProject[];status:{status:string;count:number}[];overdue:number;trend:{week:string;count:number}[];workload:{id:string|null;name:string;count:number}[];calendar:{day:string;count:number}[];deadlines:{id:string;project_id:string;title:string;project:string;due_date:string;status:string}[];deadlineTotal:number;day:string};
export async function dashboardInsights(monthInput?:string,dayInput?:string):Promise<DashboardInsights>{
 const today=todayKey(),month=monthInput||today.slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<2000||Number(month.slice(0,4))>2100)throw new Error('Invalid month');
 const day=dayInput|| (today.startsWith(month)?today:month+'-01');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!day.startsWith(month)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)throw new Error('Invalid day');
 return workspaceRead(async db=>{
  const isAdmin=Boolean((await db.query('SELECT public.is_admin() admin')).rows[0].admin);
  const projects=(await db.query<InsightProject>(`SELECT p.id,p.name,coalesce(u.full_name,u.email,'Unavailable') creator,p.is_archived,p.completed_at,
   count(t.id)::int total,count(t.id) FILTER(WHERE t.status='done')::int done,
   coalesce(bool_or(NOT t.is_archived AND (t.status='blocked' OR (t.status NOT IN ('done','in_review') AND t.due_date<$1::date))),false) attention
   FROM projects p LEFT JOIN profiles u ON u.id=p.created_by LEFT JOIN tasks t ON t.project_id=p.id GROUP BY p.id,u.full_name,u.email ORDER BY p.is_archived,p.name,p.id`,[today])).rows;
  const active=`FROM tasks t JOIN projects p ON p.id=t.project_id WHERE NOT t.is_archived AND NOT p.is_archived`;
  const status=(await db.query<{status:string;count:number}>(`SELECT t.status::text,count(*)::int count ${active} GROUP BY t.status`)).rows;
  const overdue=Number((await db.query(`SELECT count(*)::int n ${active} AND t.status NOT IN ('done','in_review') AND t.due_date<$1::date`,[today])).rows[0].n);
  const trend=(await db.query<{week:string;count:number}>(`SELECT to_char(date_trunc('week',occurred_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM-DD') week,count(*)::int count FROM completion_events WHERE occurred_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND occurred_at < (($1::date+interval '1 month')::timestamp AT TIME ZONE 'Asia/Kolkata') GROUP BY 1 ORDER BY 1`,[month+'-01'])).rows;
  const workload=(await db.query<{id:string|null;name:string;count:number}>(`SELECT a.id,coalesce(u.full_name,u.email,'Unassigned') name,count(*)::int count FROM tasks t JOIN projects p ON p.id=t.project_id LEFT JOIN LATERAL unnest(t.assignee_ids) a(id) ON true LEFT JOIN profiles u ON u.id=a.id WHERE NOT t.is_archived AND NOT p.is_archived AND t.status<>'done' AND ($1::boolean OR a.id=auth.uid()) GROUP BY a.id,u.full_name,u.email ORDER BY count DESC,name`,[isAdmin])).rows;
  const calendar=(await db.query<{day:string;count:number}>(`SELECT t.due_date::text day,count(*)::int count ${active} AND t.status<>'done' AND t.due_date >= $1::date AND t.due_date < $1::date+interval '1 month' GROUP BY t.due_date ORDER BY t.due_date`,[month+'-01'])).rows;
  const deadlines=(await db.query<DashboardInsights['deadlines'][number]>(`SELECT t.id,t.project_id,t.title,p.name project,t.due_date::text,t.status::text ${active} AND t.status<>'done' AND t.due_date=$1::date ORDER BY t.title,t.id LIMIT 50`,[day])).rows;
  return {today,month,isAdmin,projects,status,overdue,trend,workload,calendar,deadlines,deadlineTotal:calendar.find(x=>x.day===day)?.count||0,day};
 });
}
