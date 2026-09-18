BEGIN;
-- Keep existing checklist rows as historical data; no longer gate review/completion.
CREATE OR REPLACE FUNCTION public.task_write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL THEN
   IF new.project_id IS DISTINCT FROM old.project_id OR new.created_by IS DISTINCT FROM old.created_by THEN RAISE EXCEPTION 'Task ownership cannot be changed'; END IF;
   IF NOT public.is_admin() AND old.created_by IS DISTINCT FROM auth.uid() AND
      (to_jsonb(new)-ARRAY['status','due_date','updated_at']) IS DISTINCT FROM (to_jsonb(old)-ARRAY['status','due_date','updated_at']) AND NOT (public.can_manage_project(old.project_id) AND (to_jsonb(new)-ARRAY['assignee_id','assignee_ids','updated_at']) IS NOT DISTINCT FROM (to_jsonb(old)-ARRAY['assignee_id','assignee_ids','updated_at'])) THEN RAISE EXCEPTION 'Assignees may update status and deadline only'; END IF;
 END IF;
 IF new.status='done' AND (TG_OP='INSERT' OR old.status IS DISTINCT FROM new.status) THEN
   IF auth.uid() IS NOT NULL AND NOT public.review_enabled() AND NOT public.is_admin() THEN RAISE EXCEPTION 'Submit for review; only admins can approve completion'; END IF;
 END IF;
 IF new.status IN ('in_progress','in_review','done') AND (TG_OP='INSERT' OR old.status IS DISTINCT FROM new.status) AND EXISTS(SELECT 1 FROM public.task_dependencies d JOIN public.tasks t ON t.id=d.depends_on WHERE d.task_id=new.id AND t.status<>'done') THEN RAISE EXCEPTION 'Finish dependencies first'; END IF;
 IF new.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR new.assignee_id IS DISTINCT FROM old.assignee_id) AND NOT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=new.project_id AND user_id=new.assignee_id) THEN RAISE EXCEPTION 'Assignee must belong to this project'; END IF;
 IF new.recurrence<>'none' AND new.due_date IS NULL THEN RAISE EXCEPTION 'Recurring tasks require a due date'; END IF;
 IF new.recurrence='none' THEN new.next_occurrence=null;
 ELSIF TG_OP='INSERT' OR new.recurrence IS DISTINCT FROM old.recurrence OR new.due_date IS DISTINCT FROM old.due_date THEN
 new.next_occurrence = (new.due_date + CASE new.recurrence WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '1 week' ELSE interval '1 month' END)::date;
 END IF;
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
