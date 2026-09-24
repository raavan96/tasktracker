-- Owner-only, explicitly authorized one-time backfill. Set tasktracker.ack_cutoff first.
-- Does not call accept_task_assignment and therefore sends no notifications/emails.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE accepted_backfill ON COMMIT DROP AS
SELECT a.id FROM task_acknowledgements a WITH NO DATA;
INSERT INTO task_acknowledgements(task_id,user_id,assigned_at)
SELECT t.id,u,t.created_at FROM tasks t CROSS JOIN LATERAL unnest(t.assignee_ids) u
WHERE t.created_at<=current_setting('tasktracker.ack_cutoff')::timestamptz
ON CONFLICT(task_id,user_id) DO NOTHING;
WITH changed AS (
 UPDATE task_acknowledgements a SET accepted_at=now(),acceptance_source='administrative'
 FROM tasks t WHERE t.id=a.task_id AND a.accepted_at IS NULL
 AND t.created_at<=current_setting('tasktracker.ack_cutoff')::timestamptz
 AND a.assigned_at<=current_setting('tasktracker.ack_cutoff')::timestamptz RETURNING a.id
) INSERT INTO accepted_backfill SELECT id FROM changed;
INSERT INTO task_history(task_id,actor_id,field,new_value)
SELECT a.task_id,NULL,'acknowledgement','Administrative acceptance for '||coalesce(p.full_name,p.email)||' — existing-task rollout requested by Aishwarya Naidu'
FROM accepted_backfill b JOIN task_acknowledgements a ON a.id=b.id JOIN profiles p ON p.id=a.user_id;
INSERT INTO workspace_history(project_id,task_id,entity,entity_id,action,title,project_name,actor_id,actor_name,changes)
SELECT t.project_id,t.id,'Tasks',t.id,'accepted by admin',t.title,p.name,NULL,'Administrator (requested by Aishwarya Naidu)',
jsonb_build_object('acknowledgement',jsonb_build_object('before','Awaiting acceptance','after','Accepted by admin for '||coalesce(u.full_name,u.email)))
FROM accepted_backfill b JOIN task_acknowledgements a ON a.id=b.id JOIN tasks t ON t.id=a.task_id JOIN projects p ON p.id=t.project_id JOIN profiles u ON u.id=a.user_id;
SELECT count(*) AS administratively_accepted FROM accepted_backfill;
COMMIT;
