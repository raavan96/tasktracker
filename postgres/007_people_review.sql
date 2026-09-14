BEGIN;
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles DISABLE TRIGGER zz_updated_at;
UPDATE public.profiles p SET is_active=NOT u.disabled FROM auth.users u WHERE u.id=p.id AND p.is_active IS DISTINCT FROM NOT u.disabled;
ALTER TABLE public.profiles ENABLE TRIGGER zz_updated_at;
ALTER TABLE public.tasks ADD COLUMN review_version bigint NOT NULL DEFAULT 0;
CREATE TABLE public.review_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.review_settings VALUES(true,false);
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_settings_read ON public.review_settings FOR SELECT TO authenticated USING(true);
GRANT SELECT ON public.review_settings TO authenticated;
CREATE TABLE public.member_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid REFERENCES public.profiles(id),actor_id uuid REFERENCES public.profiles(id),action text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.task_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,actor_id uuid REFERENCES public.profiles(id),decision text NOT NULL,reason text NOT NULL DEFAULT '',version bigint NOT NULL,transaction_id bigint NOT NULL DEFAULT txid_current(),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX task_reviews_task_idx ON public.task_reviews(task_id,created_at);
ALTER TABLE public.member_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_events_read ON public.member_events FOR SELECT TO authenticated USING(public.is_admin());
CREATE POLICY task_reviews_read ON public.task_reviews FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.can_view_project(t.project_id)));
GRANT SELECT ON public.member_events,public.task_reviews TO authenticated;
GRANT ALL ON public.review_settings,public.member_events,public.task_reviews TO service_role;
CREATE FUNCTION public.member_active(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=p_id AND NOT disabled) $$;
CREATE FUNCTION public.assert_active() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in again'; END IF;
 PERFORM 1 FROM auth.users WHERE id=auth.uid() AND NOT disabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This account is inactive. Please sign in again'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.member_active(auth.uid()) AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin') $$;
CREATE FUNCTION public.review_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT enabled FROM public.review_settings WHERE id $$;
CREATE FUNCTION public.set_review_policy(p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM public.assert_active();IF NOT public.is_admin() OR p_enabled IS NULL THEN RAISE EXCEPTION 'Admin required';END IF;
 UPDATE public.review_settings SET enabled=p_enabled WHERE id;
END $$;
CREATE FUNCTION public.active_write_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active(); END IF;
 IF TG_OP='DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','projects','project_members','tasks','project_notes','task_comments','notifications','task_checklist','task_dependencies','task_attachments','archive_settings','archive_events','task_history','task_reviews','member_events'] LOOP
 EXECUTE format('CREATE TRIGGER a_active_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.active_write_guard()',t);
 EXECUTE format('CREATE POLICY active_account ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.member_active(auth.uid())) WITH CHECK(public.member_active(auth.uid()))',t);
 END LOOP;
END $$;
CREATE FUNCTION public.lifecycle_lock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(90261007); RETURN NULL; END $$;
CREATE TRIGGER a_lifecycle_lock BEFORE UPDATE OR DELETE ON public.profiles FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_lock();
CREATE TRIGGER a_lifecycle_lock BEFORE UPDATE OR DELETE ON auth.users FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_lock();
CREATE FUNCTION public.profile_lifecycle_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' AND (auth.uid() IS NOT NULL OR session_user='tasktracker_runtime') THEN RAISE EXCEPTION 'Deactivate the member to preserve their history'; END IF;
 IF TG_OP='UPDATE' THEN
  IF new.is_active IS DISTINCT FROM public.member_active(new.id) THEN RAISE EXCEPTION 'Use the deactivate or reactivate action'; END IF;
  IF new.role IS DISTINCT FROM old.role THEN
   IF auth.uid() IS NOT NULL AND (NOT public.is_admin() OR (old.id=auth.uid() AND new.role<>'admin')) THEN RAISE EXCEPTION 'Another active admin must change this role'; END IF;
   IF old.role='admin' AND new.role<>'admin' AND old.is_active AND NOT EXISTS(SELECT 1 FROM profiles WHERE id<>old.id AND role='admin' AND is_active) THEN RAISE EXCEPTION 'Keep at least one active admin'; END IF;
   INSERT INTO member_events(member_id,actor_id,action,reason) VALUES(old.id,auth.uid(),'role_changed',old.role::text||' → '||new.role::text);
  END IF; RETURN new;
 END IF; RETURN old;
END $$;
CREATE TRIGGER profile_lifecycle_guard BEFORE UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_lifecycle_guard();
CREATE FUNCTION public.auth_lifecycle_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' AND (auth.uid() IS NOT NULL OR session_user='tasktracker_runtime') THEN RAISE EXCEPTION 'Deactivate the member to preserve their history'; END IF;
 IF TG_OP='UPDATE' AND new.disabled IS DISTINCT FROM old.disabled THEN
  IF auth.uid() IS NOT NULL AND (NOT public.is_admin() OR old.id=auth.uid()) THEN RAISE EXCEPTION 'Another active admin is required'; END IF;
  IF new.disabled AND EXISTS(SELECT 1 FROM profiles WHERE id=old.id AND role='admin') AND NOT EXISTS(SELECT 1 FROM profiles p JOIN auth.users u ON u.id=p.id WHERE p.id<>old.id AND p.role='admin' AND NOT u.disabled) THEN RAISE EXCEPTION 'Keep at least one active admin'; END IF;
  DELETE FROM auth.sessions WHERE user_id=old.id;
 END IF;
 IF TG_OP='DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END $$;
CREATE TRIGGER auth_lifecycle_guard BEFORE UPDATE OR DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.auth_lifecycle_guard();
CREATE FUNCTION public.sync_member_active() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE profiles SET is_active=NOT new.disabled WHERE id=new.id;
 RETURN new;
END $$;
CREATE TRIGGER sync_member_active AFTER UPDATE OF disabled ON auth.users FOR EACH ROW WHEN(old.disabled IS DISTINCT FROM new.disabled) EXECUTE FUNCTION public.sync_member_active();
CREATE FUNCTION public.set_member_active(p_member uuid,p_active boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(90261007);PERFORM public.assert_active();
 IF NOT public.is_admin() OR p_member=auth.uid() OR p_active IS NULL THEN RAISE EXCEPTION 'Another active admin is required'; END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Enter a reason (1–1000 characters)'; END IF;
 UPDATE auth.users SET disabled=NOT p_active WHERE id=p_member AND disabled=p_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member state changed. Refresh and try again'; END IF;
 INSERT INTO member_events(member_id,actor_id,action,reason) VALUES(p_member,auth.uid(),CASE WHEN p_active THEN 'reactivated' ELSE 'deactivated' END,trim(p_reason));
 -- Skip any missed recurrence dates rather than generating a backlog on resumption.
 IF p_active THEN UPDATE tasks SET next_occurrence=greatest(next_occurrence,(now() AT TIME ZONE 'Asia/Kolkata')::date+1) WHERE (assignee_id=p_member OR created_by=p_member) AND recurrence<>'none' AND NOT is_archived AND EXISTS(SELECT 1 FROM projects p WHERE p.id=tasks.project_id AND NOT p.is_archived); END IF;
END $$;
CREATE FUNCTION public.active_membership_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.member_active(new.user_id) THEN RAISE EXCEPTION 'Choose an active teammate'; END IF; RETURN new;
END $$;
CREATE TRIGGER active_membership_guard BEFORE INSERT OR UPDATE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.active_membership_guard();
CREATE OR REPLACE FUNCTION public.task_write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL THEN
   IF new.project_id IS DISTINCT FROM old.project_id OR new.created_by IS DISTINCT FROM old.created_by THEN RAISE EXCEPTION 'Task ownership cannot be changed'; END IF;
   IF NOT public.is_admin() AND old.created_by IS DISTINCT FROM auth.uid() AND
      (to_jsonb(new)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(old)-ARRAY['status','updated_at']) AND NOT (public.can_manage_project(old.project_id) AND (to_jsonb(new)-ARRAY['assignee_id','updated_at']) IS NOT DISTINCT FROM (to_jsonb(old)-ARRAY['assignee_id','updated_at'])) THEN RAISE EXCEPTION 'Assignees may update status only'; END IF;
 END IF;
 IF new.status='done' AND (TG_OP='INSERT' OR old.status IS DISTINCT FROM new.status) THEN
   IF auth.uid() IS NOT NULL AND NOT public.review_enabled() AND NOT public.is_admin() THEN RAISE EXCEPTION 'Submit for review; only admins can approve completion'; END IF;
   IF EXISTS(SELECT 1 FROM public.task_checklist WHERE task_id=new.id AND NOT completed) THEN RAISE EXCEPTION 'Complete the checklist before approval'; END IF;
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

CREATE FUNCTION public.review_task_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE action text; material boolean; BEGIN
 IF new.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR new.assignee_id IS DISTINCT FROM old.assignee_id) AND NOT public.member_active(new.assignee_id) THEN RAISE EXCEPTION 'Choose an active assignee'; END IF;
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NOT NULL AND new.status IN ('done','in_review') THEN RAISE EXCEPTION 'Create the task, then submit it for review'; END IF;
  new.review_version=0; RETURN new;
 END IF;
 IF new.assignee_id IS DISTINCT FROM old.assignee_id AND new.recurrence<>'none' THEN new.next_occurrence=greatest(new.next_occurrence,(now() AT TIME ZONE 'Asia/Kolkata')::date+1); END IF;
 IF auth.uid() IS NOT NULL THEN
  SELECT decision INTO action FROM task_reviews WHERE task_id=old.id AND version=old.review_version AND transaction_id=txid_current() AND actor_id=auth.uid() ORDER BY created_at DESC LIMIT 1;
  material=(to_jsonb(new)-ARRAY['status','updated_at','review_version','next_occurrence','is_archived','archived_at','archived_by','archive_reason','completed_at','restored_at']) IS DISTINCT FROM (to_jsonb(old)-ARRAY['status','updated_at','review_version','next_occurrence','is_archived','archived_at','archived_by','archive_reason','completed_at','restored_at']);
  IF old.status='done' AND (material OR new.status<>old.status) AND action IS DISTINCT FROM 'reopen' THEN RAISE EXCEPTION 'Reopen the completed task with a reason before editing'; END IF;
  IF new.status='done' AND old.status<>'done' AND action IS DISTINCT FROM 'approve' THEN RAISE EXCEPTION 'Use Approve & complete after submission'; END IF;
  IF new.status='in_review' AND old.status<>'in_review' AND action IS DISTINCT FROM 'submit' THEN RAISE EXCEPTION 'Use Submit for review'; END IF;
  IF old.status='in_review' AND material THEN
   new.status='in_progress';INSERT INTO task_reviews(task_id,actor_id,decision,reason,version) VALUES(old.id,auth.uid(),'invalidated','Task details changed; submit again.',old.review_version);
  ELSIF old.status='in_review' AND new.status<>old.status AND action IS NULL THEN RAISE EXCEPTION 'Use Request changes or Withdraw submission'; END IF;
 END IF;
 new.review_version=old.review_version+1;
 RETURN new;
END $$;
CREATE TRIGGER zz_review_guard BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.review_task_guard();
CREATE FUNCTION public.review_task(p_task uuid,p_version bigint,p_decision text,p_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tasks%ROWTYPE; reviewer boolean; next_status task_status; BEGIN
 PERFORM public.assert_active();SELECT * INTO t FROM tasks WHERE id=p_task FOR UPDATE;
 IF NOT FOUND OR NOT public.can_work_project(t.project_id) OR t.is_archived THEN RAISE EXCEPTION 'Task unavailable or read-only'; END IF;
 IF p_version IS NULL OR p_version<0 OR t.review_version<>p_version THEN RAISE EXCEPTION 'This task changed. Refresh before reviewing'; END IF;
 reviewer=(public.is_admin() OR t.created_by=auth.uid()) AND t.assignee_id IS DISTINCT FROM auth.uid();
 IF p_decision IN ('changes','withdraw','reopen') AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Enter a reason (1–2000 characters)'; END IF;
 IF p_decision='submit' THEN
  IF t.status IN ('done','in_review') OR t.assignee_id IS NULL OR NOT public.member_active(t.assignee_id) OR NOT(public.is_admin() OR t.assignee_id=auth.uid()) THEN RAISE EXCEPTION 'An active assignee or admin must submit assigned work'; END IF;
  IF EXISTS(SELECT 1 FROM task_checklist WHERE task_id=t.id AND NOT completed) THEN RAISE EXCEPTION 'Complete the checklist before submitting'; END IF;
  next_status='in_review';
 ELSIF p_decision IN ('approve','changes') THEN
  IF t.status<>'in_review' OR NOT reviewer OR (NOT public.review_enabled() AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Only an eligible creator or admin can review; no self-approval'; END IF;
  next_status=CASE WHEN p_decision='approve' THEN 'done'::task_status ELSE 'in_progress'::task_status END;
 ELSIF p_decision='withdraw' THEN
  IF t.status<>'in_review' OR NOT(public.is_admin() OR t.assignee_id=auth.uid()) THEN RAISE EXCEPTION 'Only the assignee or admin can withdraw';END IF;next_status='in_progress';
 ELSIF p_decision='reopen' THEN
  IF t.status<>'done' OR NOT(public.is_admin() OR t.created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the creator or admin can reopen';END IF;next_status='in_progress';
 ELSE RAISE EXCEPTION 'Choose a valid review action'; END IF;
 INSERT INTO task_reviews(task_id,actor_id,decision,reason,version) VALUES(t.id,auth.uid(),p_decision,coalesce(trim(p_reason),''),t.review_version);
 UPDATE tasks SET status=next_status WHERE id=t.id;
END $$;
CREATE FUNCTION public.review_support_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t tasks%ROWTYPE; target uuid; BEGIN
 IF TG_OP='UPDATE' AND new.task_id IS DISTINCT FROM old.task_id THEN RAISE EXCEPTION 'Supporting work cannot move between tasks'; END IF;
 target=CASE WHEN TG_OP='DELETE' THEN old.task_id ELSE new.task_id END;
 SELECT * INTO t FROM tasks WHERE id=target FOR UPDATE;
 IF t.status IN ('in_review','done') AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Withdraw or reopen before changing supporting work';END IF;
 IF TG_OP='DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END $$;
CREATE TRIGGER review_support_guard BEFORE INSERT OR UPDATE OR DELETE ON task_checklist FOR EACH ROW EXECUTE FUNCTION review_support_guard();
CREATE TRIGGER review_support_guard BEFORE INSERT OR UPDATE OR DELETE ON task_dependencies FOR EACH ROW EXECUTE FUNCTION review_support_guard();
CREATE TRIGGER review_support_guard BEFORE INSERT OR UPDATE OR DELETE ON task_attachments FOR EACH ROW EXECUTE FUNCTION review_support_guard();
DROP TRIGGER notify_task_review ON tasks;
CREATE FUNCTION public.notify_review_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.decision='submit' THEN
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key)
 SELECT p.id,new.task_id,'Ready for review',t.title,new.id::text||':'||p.id::text FROM profiles p JOIN tasks t ON t.id=new.task_id
 WHERE p.is_active AND p.id IS DISTINCT FROM t.assignee_id AND (p.role='admin' OR (public.review_enabled() AND p.id=t.created_by AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=t.project_id AND m.user_id=p.id))) ON CONFLICT DO NOTHING;
 ELSE
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key)
 SELECT t.assignee_id,t.id,CASE new.decision WHEN 'approve' THEN 'Task approved' WHEN 'changes' THEN 'Changes requested' WHEN 'invalidated' THEN 'Review invalidated' ELSE 'Task review updated' END,t.title||CASE WHEN new.reason<>'' THEN ' · '||new.reason ELSE '' END,new.id::text||':'||t.assignee_id::text FROM tasks t WHERE t.id=new.task_id AND public.member_active(t.assignee_id) ON CONFLICT DO NOTHING;
 END IF;RETURN new;
END $$;
CREATE TRIGGER notify_review_event AFTER INSERT ON task_reviews FOR EACH ROW EXECUTE FUNCTION notify_review_event();
CREATE FUNCTION public.reassign_member_tasks(p_member uuid,p_project uuid,p_replacement uuid,p_expected jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE actual jsonb; BEGIN
 PERFORM public.assert_active();IF NOT public.is_admin() OR p_replacement=p_member THEN RAISE EXCEPTION 'Admin and another assignee required'; END IF;
 IF NOT public.can_work_project(p_project) THEN RAISE EXCEPTION 'Restore this project first'; END IF;
 IF p_replacement IS NOT NULL AND (NOT public.member_active(p_replacement) OR NOT EXISTS(SELECT 1 FROM project_members WHERE project_id=p_project AND user_id=p_replacement)) THEN RAISE EXCEPTION 'Choose an active member of this project'; END IF;
 PERFORM 1 FROM tasks WHERE project_id=p_project AND assignee_id=p_member AND status<>'done' AND NOT is_archived ORDER BY id FOR UPDATE;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'version',review_version) ORDER BY id),'[]'::jsonb) INTO actual FROM tasks WHERE project_id=p_project AND assignee_id=p_member AND status<>'done' AND NOT is_archived;
 IF actual IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Assignments changed. Refresh the preview'; END IF;
 UPDATE tasks SET assignee_id=p_replacement WHERE id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(actual) v) AND assignee_id=p_member;
 INSERT INTO member_events(member_id,actor_id,action,reason) VALUES(p_member,auth.uid(),'reassigned','Project '||p_project::text||' · '||jsonb_array_length(actual)||' tasks · replacement '||coalesce(p_replacement::text,'Unassigned'));
END $$;
CREATE OR REPLACE FUNCTION public.run_workspace_automation() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.tasks%ROWTYPE; new_id uuid; due date; n int; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 -- One runner at a time; unique occurrence and notification keys make retries safe.
 IF NOT pg_try_advisory_xact_lock(90261003) THEN RETURN; END IF;
 PERFORM public.run_archive_automation();
 FOR source IN SELECT t.* FROM public.tasks t JOIN public.projects p ON p.id=t.project_id WHERE t.recurrence<>'none' AND t.next_occurrence<=today AND NOT p.is_archived AND NOT t.is_archived AND t.created_by IS NOT NULL AND public.member_active(t.created_by) AND (t.assignee_id IS NULL OR public.member_active(t.assignee_id)) FOR UPDATE OF t LOOP
   due:=source.next_occurrence; n:=0;
   -- Resume on the next scheduled date; do not recreate occurrences missed while archived.
   WHILE due < (SELECT greatest(source.restored_at,p.restored_at)::date FROM projects p WHERE p.id=source.project_id) LOOP
     due:=public.next_task_date(due,source.recurrence,source.due_date);
   END LOOP;
   WHILE due<=today AND n<30 LOOP
     new_id:=NULL;
     INSERT INTO public.tasks(project_id,title,description,priority,status,assignee_id,created_by,due_date,recurrence_source,occurrence_date)
     VALUES(source.project_id,source.title,source.description,source.priority,'todo',CASE WHEN EXISTS(SELECT 1 FROM public.project_members WHERE project_id=source.project_id AND user_id=source.assignee_id) THEN source.assignee_id ELSE NULL END,source.created_by,due,source.id,due)
     ON CONFLICT(recurrence_source,occurrence_date) DO NOTHING RETURNING id INTO new_id;
     IF new_id IS NOT NULL THEN INSERT INTO public.task_checklist(task_id,title) SELECT new_id,title FROM public.task_checklist WHERE task_id=source.id; END IF;
     due:=public.next_task_date(due,source.recurrence,source.due_date); n:=n+1;
   END LOOP;
   UPDATE public.tasks SET next_occurrence=due WHERE id=source.id;
 END LOOP;
 INSERT INTO public.notifications(user_id,task_id,title,message,dedupe_key)
 SELECT t.assignee_id,t.id,CASE WHEN t.due_date<today THEN 'Task overdue' WHEN t.due_date=today THEN 'Task due today' ELSE 'Task due tomorrow' END,
 t.title || ' · Due ' || t.due_date::text,
 t.id::text || ':' || t.assignee_id::text || ':' || today::text || ':deadline'
 FROM public.tasks t JOIN public.projects p ON p.id=t.project_id
 WHERE t.assignee_id IS NOT NULL AND public.member_active(t.assignee_id) AND t.status NOT IN ('done','in_review') AND NOT p.is_archived AND NOT t.is_archived AND t.due_date<=today+1
 AND EXISTS(SELECT 1 FROM public.project_members WHERE project_id=t.project_id AND user_id=t.assignee_id)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END $$;


REVOKE ALL ON FUNCTION public.set_member_active(uuid,boolean,text),public.set_review_policy(boolean),public.review_task(uuid,bigint,text,text),public.reassign_member_tasks(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_member_active(uuid,boolean,text),public.set_review_policy(boolean),public.review_task(uuid,bigint,text,text),public.reassign_member_tasks(uuid,uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.remove_member_and_reassign_tasks(p_project_id uuid,p_member_id uuid,p_new_assignee_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.assert_active();
 IF NOT public.can_manage_project(p_project_id) THEN RAISE EXCEPTION 'Project owner or admin required'; END IF;
 IF EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id AND created_by=p_member_id) THEN RAISE EXCEPTION 'The project owner cannot be removed'; END IF;
 IF p_new_assignee_id IS NOT NULL AND (NOT public.member_active(p_new_assignee_id) OR p_new_assignee_id=p_member_id OR NOT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=p_project_id AND user_id=p_new_assignee_id)) THEN RAISE EXCEPTION 'Choose another project member'; END IF;
 UPDATE public.tasks SET assignee_id=p_new_assignee_id WHERE project_id=p_project_id AND assignee_id=p_member_id AND status<>'done' AND NOT is_archived;
 DELETE FROM public.project_members WHERE project_id=p_project_id AND user_id=p_member_id;
END $$;

COMMIT;
