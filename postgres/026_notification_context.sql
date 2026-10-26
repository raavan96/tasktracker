BEGIN;
CREATE FUNCTION public.can_review_workspace_task(p_task uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(public.member_active(auth.uid()) AND EXISTS(
  SELECT 1 FROM tasks t JOIN projects p ON p.id=t.project_id
  WHERE t.id=p_task AND NOT t.is_archived AND NOT p.is_archived AND public.can_work_project(p.id)
   AND (public.is_admin() OR (public.review_enabled() AND t.created_by=auth.uid() AND NOT(auth.uid()=ANY(t.assignee_ids))))
 ),false)
$$;
REVOKE ALL ON FUNCTION public.can_review_workspace_task(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_review_workspace_task(uuid) TO authenticated,service_role;
ALTER TABLE notifications ADD COLUMN actor_id uuid, ADD COLUMN actor_name text, ADD COLUMN event_review_id uuid, ADD COLUMN assignment_id uuid, ADD COLUMN event_transaction_id text;
-- Recover only directly linked historical review/remark events; never use a latest-actor guess.
UPDATE notifications n SET actor_id=r.actor_id,actor_name=coalesce(p.full_name,p.email),event_review_id=r.id
 FROM task_reviews r LEFT JOIN profiles p ON p.id=r.actor_id
 WHERE r.id::text=split_part(n.dedupe_key,':',1) AND r.task_id=n.task_id;
UPDATE notifications n SET actor_id=c.author_id,actor_name=coalesce(p.full_name,p.email)
 FROM task_comments c JOIN profiles p ON p.id=c.author_id
 WHERE n.dedupe_key LIKE 'mention:%' AND c.id::text=split_part(n.dedupe_key,':',2) AND c.task_id=n.task_id;
CREATE FUNCTION capture_notification_context() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 new.actor_id=auth.uid();
 SELECT coalesce(full_name,email) INTO new.actor_name FROM profiles WHERE id=new.actor_id;
 new.event_transaction_id=pg_current_xact_id()::text;
 SELECT r.id,r.actor_id,coalesce(p.full_name,p.email) INTO new.event_review_id,new.actor_id,new.actor_name
 FROM task_reviews r LEFT JOIN profiles p ON p.id=r.actor_id
 WHERE r.id::text=split_part(new.dedupe_key,':',1) AND r.task_id=new.task_id;
 IF new.event_review_id IS NULL THEN
  new.actor_id=auth.uid();SELECT coalesce(full_name,email) INTO new.actor_name FROM profiles WHERE id=new.actor_id;
 END IF;
 IF new.title='Task assigned' THEN SELECT id INTO new.assignment_id FROM task_acknowledgements WHERE task_id=new.task_id AND user_id=new.user_id;END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION capture_notification_context() FROM PUBLIC;
CREATE TRIGGER notification_context BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION capture_notification_context();
-- Assignment notices may be inserted before their receipt in the same task trigger chain.
CREATE FUNCTION link_assignment_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE notifications SET assignment_id=new.id WHERE task_id=new.task_id AND user_id=new.user_id AND title='Task assigned' AND assignment_id IS NULL AND event_transaction_id=pg_current_xact_id()::text;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION link_assignment_notice() FROM PUBLIC;
CREATE TRIGGER link_assignment_notice AFTER INSERT ON task_acknowledgements FOR EACH ROW EXECUTE FUNCTION link_assignment_notice();
CREATE OR REPLACE FUNCTION public.notify_review_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.decision='submit' THEN
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key)
 SELECT p.id,new.task_id,'Ready for review',t.title,new.id::text||':'||p.id::text FROM profiles p JOIN tasks t ON t.id=new.task_id
 WHERE p.is_active AND (p.role='admin' OR (public.review_enabled() AND p.id=t.created_by AND NOT(p.id=ANY(t.assignee_ids)) AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=t.project_id AND m.user_id=p.id))) ON CONFLICT DO NOTHING;
 ELSE
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key)
 SELECT a,t.id,CASE new.decision WHEN 'approve' THEN 'Task approved' WHEN 'changes' THEN 'Changes requested' WHEN 'invalidated' THEN 'Review invalidated' ELSE 'Task review updated' END,t.title||CASE WHEN new.reason<>'' THEN ' · '||new.reason ELSE '' END,new.id::text||':'||a::text FROM tasks t CROSS JOIN LATERAL unnest(t.assignee_ids) a WHERE t.id=new.task_id AND public.member_active(a) ON CONFLICT DO NOTHING;
 END IF;RETURN new;
END $$;
CREATE OR REPLACE FUNCTION public.review_task(p_task uuid,p_version bigint,p_decision text,p_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tasks%ROWTYPE; reviewer boolean; next_status task_status; BEGIN
 PERFORM public.assert_active();SELECT * INTO t FROM tasks WHERE id=p_task FOR UPDATE;
 IF NOT FOUND OR NOT public.can_work_project(t.project_id) OR t.is_archived THEN RAISE EXCEPTION 'Task unavailable or read-only'; END IF;
 IF p_version IS NULL OR p_version<0 OR t.review_version<>p_version THEN RAISE EXCEPTION 'This task changed. Refresh before reviewing'; END IF;
 reviewer=public.can_review_workspace_task(t.id);
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
