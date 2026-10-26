// One classification feeds both category counts and paginated rows, under RLS.
export const notificationContextSQL=`WITH context AS (
 SELECT n.*,t.status,t.due_date,t.assignee_ids,t.created_by,
  coalesce(t.is_archived,false) OR coalesce(pr.is_archived,false) archived,
  coalesce(auth.uid()=ANY(t.assignee_ids),false) assigned,
  coalesce(public.can_work_project(t.project_id),false) workable,
  public.can_review_workspace_task(t.id) reviewer,
  receipt.id current_assignment,receipt.accepted_at,
  latest.id latest_review_id,
  (n.title='Chat mention' OR n.title='You were mentioned' OR coalesce(n.dedupe_key LIKE 'mention:%',false)) mentioned,
  CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'project_id',t.project_id,'title',t.title,'status',t.status,'is_archived',coalesce(t.is_archived,false) OR coalesce(pr.is_archived,false),'project_name',pr.name,'assigned_to_recipient',auth.uid()=ANY(t.assignee_ids),'assignment_accepted',receipt.accepted_at IS NOT NULL) END task
 FROM notifications n LEFT JOIN tasks t ON t.id=n.task_id LEFT JOIN projects pr ON pr.id=t.project_id
 LEFT JOIN task_acknowledgements receipt ON receipt.id=n.assignment_id AND receipt.task_id=t.id AND receipt.user_id=n.user_id
 LEFT JOIN LATERAL (SELECT id FROM task_reviews WHERE task_id=t.id ORDER BY version DESC,created_at DESC,id DESC LIMIT 1) latest ON true
 WHERE n.user_id=$1
), resolved AS (
 SELECT context.*,
  coalesce(event_review_id=latest_review_id,false) current_event,
  coalesce(NOT archived AND workable AND CASE
   WHEN title='Ready for review' THEN status='in_review' AND reviewer AND event_review_id=latest_review_id
   WHEN title='Task assigned' THEN assigned AND status NOT IN ('done','in_review') AND current_assignment IS NOT NULL AND accepted_at IS NULL
   WHEN title='Changes requested' THEN status='in_progress' AND event_review_id=latest_review_id AND (assigned OR created_by=auth.uid() OR public.is_admin())
   WHEN title IN ('Due today','Task due today','Task overdue','Due tomorrow','Task due tomorrow') THEN assigned AND status NOT IN ('done','in_review') AND due_date<=(now() AT TIME ZONE 'Asia/Kolkata')::date+1
   WHEN title='Dependency unblocked' THEN assigned AND status IN ('todo','blocked') AND NOT EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks b ON b.id=d.depends_on WHERE d.task_id=context.task_id AND b.status<>'done')
   ELSE false END,false) action_needed
 FROM context
), classified AS (SELECT resolved.*,CASE WHEN mentioned THEN 'mentions' WHEN action_needed THEN 'action' ELSE 'updates' END category FROM resolved)`;
