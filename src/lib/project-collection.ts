import 'server-only';
import {workspaceRead} from './workspace-data';
import {projectRecencySQL} from './project-recency';
export type ProjectStats={id:string;name:string;description:string|null;created_at:string;created_by:string;is_archived:boolean;completed_at:string|null;last_task_edit_at:string|null;favorite:boolean;member_count:number;total_tasks:number;completed_tasks:number;needs_attention:boolean;ready:boolean;overdue:number;today:number;in_progress:number;in_review:number;done:number};
export async function projectCollectionData(){return workspaceRead(async(db,userId)=>{
 const projects=(await db.query<ProjectStats>(`WITH recency AS (${projectRecencySQL})
 SELECT p.id,p.name,p.description,p.created_at,p.created_by,p.is_archived,p.completed_at,r.last_task_edit_at,EXISTS(SELECT 1 FROM project_favorites f WHERE f.project_id=p.id AND f.user_id=auth.uid()) favorite,
 (SELECT count(*)::int FROM project_members m WHERE m.project_id=p.id) member_count,
 count(t.id)::int total_tasks,count(t.id) FILTER(WHERE t.status='done')::int completed_tasks,
 coalesce(bool_or(NOT t.is_archived AND (t.status='blocked' OR (t.status NOT IN ('done','in_review') AND t.due_date<(now() AT TIME ZONE 'Asia/Kolkata')::date))),false) needs_attention,
 count(t.id)>0 AND coalesce(bool_and(t.status='done'),false) ready,
 count(t.id) FILTER(WHERE NOT t.is_archived AND t.status NOT IN ('done','in_review') AND t.due_date<(now() AT TIME ZONE 'Asia/Kolkata')::date)::int overdue,
 count(t.id) FILTER(WHERE NOT t.is_archived AND t.status NOT IN ('done','in_review') AND t.due_date=(now() AT TIME ZONE 'Asia/Kolkata')::date)::int today,
 count(t.id) FILTER(WHERE NOT t.is_archived AND t.status='in_progress')::int in_progress,
 count(t.id) FILTER(WHERE NOT t.is_archived AND t.status='in_review')::int in_review,
 count(t.id) FILTER(WHERE NOT t.is_archived AND t.status='done')::int done
 FROM projects p LEFT JOIN tasks t ON t.project_id=p.id LEFT JOIN recency r ON r.project_id=p.id
 GROUP BY p.id,r.last_task_edit_at ORDER BY p.created_at DESC,p.id`)).rows;
 const people=(await db.query<{id:string;full_name:string|null;email:string;is_active:boolean}>('SELECT id,full_name,email,is_active FROM profiles ORDER BY full_name,id')).rows;
 const isAdmin=Boolean((await db.query('SELECT public.is_admin() admin')).rows[0]?.admin);
 return {projects,people,userId,isAdmin};
});}
