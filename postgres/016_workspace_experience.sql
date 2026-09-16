BEGIN;
-- New events only. Existing project memberships are not backfilled into email.
ALTER TABLE email_queue ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE email_queue DROP CONSTRAINT email_queue_category_check;
ALTER TABLE email_queue ADD CONSTRAINT email_queue_category_check CHECK(category IN ('assignment','project_assignment','mention','review_requested','approved','changes_requested','review_updated','deadline_digest','weekly_report'));
ALTER TABLE email_queue DROP CONSTRAINT email_queue_task_required;
ALTER TABLE email_queue ADD CONSTRAINT email_queue_task_required CHECK(
 (category='project_assignment' AND project_id IS NOT NULL AND task_id IS NULL) OR
 (category IN ('deadline_digest','weekly_report')) OR
 (category NOT IN ('project_assignment','deadline_digest','weekly_report') AND task_id IS NOT NULL));
CREATE FUNCTION can_email_project(p_user uuid,p_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM projects p JOIN project_members m ON m.project_id=p.id WHERE p.id=p_project AND m.user_id=p_user AND member_active(p_user) AND NOT p.is_archived);
$$;
REVOKE ALL ON FUNCTION can_email_project(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_email_project(uuid,uuid) TO service_role;
CREATE FUNCTION capture_project_assignment_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled)
 AND EXISTS(SELECT 1 FROM email_preferences WHERE user_id=new.user_id AND enabled AND assignments)
 AND can_email_project(new.user_id,new.project_id) THEN
  INSERT INTO email_queue(user_id,project_id,category,event_key) VALUES(new.user_id,new.project_id,'project_assignment','project-member:'||gen_random_uuid());
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION capture_project_assignment_email() FROM PUBLIC;
CREATE TRIGGER project_assignment_email AFTER INSERT ON project_members FOR EACH ROW EXECUTE FUNCTION capture_project_assignment_email();
CREATE OR REPLACE FUNCTION capture_notification_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kind text; prefs email_preferences%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled) OR (new.user_id=auth.uid() AND new.title<>'Task assigned') OR new.task_id IS NULL THEN RETURN new; END IF;
 SELECT * INTO prefs FROM email_preferences WHERE user_id=new.user_id;
 IF NOT FOUND OR NOT prefs.enabled OR NOT can_email_task(new.user_id,new.task_id) THEN RETURN new;END IF;
 kind=CASE WHEN new.title='Task assigned' AND prefs.assignments THEN 'assignment' WHEN new.dedupe_key LIKE 'mention:%' AND prefs.mentions THEN 'mention' WHEN prefs.reviews THEN CASE new.title WHEN 'Ready for review' THEN 'review_requested' WHEN 'Task approved' THEN 'approved' WHEN 'Changes requested' THEN 'changes_requested' WHEN 'Review invalidated' THEN 'review_updated' WHEN 'Task review updated' THEN 'review_updated' END END;
 IF kind IS NOT NULL THEN INSERT INTO email_queue(user_id,task_id,category,event_key,note) VALUES(new.user_id,new.task_id,kind,'notice:'||coalesce(new.dedupe_key,new.id::text),left(new.message,2000)) ON CONFLICT(event_key) DO NOTHING;END IF;
 RETURN new;
END $$;
CREATE OR REPLACE FUNCTION public.review_task(p_task uuid,p_version bigint,p_decision text,p_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tasks%ROWTYPE; reviewer boolean; next_status task_status; BEGIN
 PERFORM public.assert_active();SELECT * INTO t FROM tasks WHERE id=p_task FOR UPDATE;
 IF NOT FOUND OR NOT public.can_work_project(t.project_id) OR t.is_archived THEN RAISE EXCEPTION 'Task unavailable or read-only'; END IF;
 IF p_version IS NULL OR p_version<0 OR t.review_version<>p_version THEN RAISE EXCEPTION 'This task changed. Refresh before reviewing'; END IF;
 reviewer=public.is_admin() OR (t.created_by=auth.uid() AND NOT(auth.uid()=ANY(t.assignee_ids)));
 IF p_decision IN ('changes','withdraw','reopen') AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Enter a reason (1–2000 characters)'; END IF;
 IF p_decision='submit' THEN
  IF t.status IN ('done','in_review') OR cardinality(t.assignee_ids)=0 OR EXISTS(SELECT 1 FROM unnest(t.assignee_ids) a WHERE NOT public.member_active(a)) OR NOT(public.is_admin() OR t.created_by=auth.uid() OR auth.uid()=ANY(t.assignee_ids)) THEN RAISE EXCEPTION 'The creator, an active assignee or admin must submit assigned work'; END IF;
  IF EXISTS(SELECT 1 FROM task_checklist WHERE task_id=t.id AND NOT completed) THEN RAISE EXCEPTION 'Complete the checklist before submitting'; END IF;
  next_status='in_review';
 ELSIF p_decision IN ('approve','changes') THEN
  IF t.status<>'in_review' OR NOT reviewer OR (NOT public.review_enabled() AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Only an admin or eligible non-assigned creator can review'; END IF;
  next_status=CASE WHEN p_decision='approve' THEN 'done'::task_status ELSE 'in_progress'::task_status END;
 ELSIF p_decision='withdraw' THEN
  IF t.status<>'in_review' OR NOT(public.is_admin() OR t.created_by=auth.uid() OR auth.uid()=ANY(t.assignee_ids)) THEN RAISE EXCEPTION 'Only the creator, assignee or admin can withdraw';END IF;next_status='in_progress';
 ELSIF p_decision='reopen' THEN
  IF t.status<>'done' OR NOT(public.is_admin() OR t.created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the creator or admin can reopen';END IF;next_status='in_progress';
 ELSE RAISE EXCEPTION 'Choose a valid review action'; END IF;
 INSERT INTO task_reviews(task_id,actor_id,decision,reason,version) VALUES(t.id,auth.uid(),p_decision,coalesce(trim(p_reason),''),t.review_version);
 UPDATE tasks SET status=next_status WHERE id=t.id;
END $$;
COMMIT;
