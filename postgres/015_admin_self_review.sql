BEGIN;
CREATE OR REPLACE FUNCTION public.review_task(p_task uuid,p_version bigint,p_decision text,p_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tasks%ROWTYPE; reviewer boolean; next_status task_status; BEGIN
 PERFORM public.assert_active();SELECT * INTO t FROM tasks WHERE id=p_task FOR UPDATE;
 IF NOT FOUND OR NOT public.can_work_project(t.project_id) OR t.is_archived THEN RAISE EXCEPTION 'Task unavailable or read-only'; END IF;
 IF p_version IS NULL OR p_version<0 OR t.review_version<>p_version THEN RAISE EXCEPTION 'This task changed. Refresh before reviewing'; END IF;
 reviewer=public.is_admin() OR (t.created_by=auth.uid() AND NOT(auth.uid()=ANY(t.assignee_ids)));
 IF p_decision IN ('changes','withdraw','reopen') AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Enter a reason (1–2000 characters)'; END IF;
 IF p_decision='submit' THEN
  IF t.status IN ('done','in_review') OR cardinality(t.assignee_ids)=0 OR EXISTS(SELECT 1 FROM unnest(t.assignee_ids) a WHERE NOT public.member_active(a)) OR NOT(public.is_admin() OR auth.uid()=ANY(t.assignee_ids)) THEN RAISE EXCEPTION 'An active assignee or admin must submit assigned work'; END IF;
  IF EXISTS(SELECT 1 FROM task_checklist WHERE task_id=t.id AND NOT completed) THEN RAISE EXCEPTION 'Complete the checklist before submitting'; END IF;
  next_status='in_review';
 ELSIF p_decision IN ('approve','changes') THEN
  IF t.status<>'in_review' OR NOT reviewer OR (NOT public.review_enabled() AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Only an admin or eligible non-assigned creator can review'; END IF;
  next_status=CASE WHEN p_decision='approve' THEN 'done'::task_status ELSE 'in_progress'::task_status END;
 ELSIF p_decision='withdraw' THEN
  IF t.status<>'in_review' OR NOT(public.is_admin() OR auth.uid()=ANY(t.assignee_ids)) THEN RAISE EXCEPTION 'Only the assignee or admin can withdraw';END IF;next_status='in_progress';
 ELSIF p_decision='reopen' THEN
  IF t.status<>'done' OR NOT(public.is_admin() OR t.created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the creator or admin can reopen';END IF;next_status='in_progress';
 ELSE RAISE EXCEPTION 'Choose a valid review action'; END IF;
 INSERT INTO task_reviews(task_id,actor_id,decision,reason,version) VALUES(t.id,auth.uid(),p_decision,coalesce(trim(p_reason),''),t.review_version);
 UPDATE tasks SET status=next_status WHERE id=t.id;
END $$;
COMMIT;
