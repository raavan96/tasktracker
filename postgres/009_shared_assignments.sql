BEGIN;
ALTER TABLE tasks ADD COLUMN assignee_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE tasks DISABLE TRIGGER USER;
UPDATE tasks SET assignee_ids=ARRAY[assignee_id] WHERE assignee_id IS NOT NULL;
ALTER TABLE tasks ENABLE TRIGGER USER;
ALTER TABLE task_schedules ADD COLUMN assignee_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE task_schedules SET assignee_ids=ARRAY[assignee_id] WHERE assignee_id IS NOT NULL;
ALTER TABLE completion_events ADD COLUMN assignee_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE completion_events SET assignee_ids=ARRAY[assignee_id] WHERE assignee_id IS NOT NULL;
CREATE INDEX tasks_assignees_idx ON tasks USING gin(assignee_ids);
CREATE FUNCTION assignment_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' AND cardinality(new.assignee_ids)=0 AND new.assignee_id IS NOT NULL THEN new.assignee_ids=ARRAY[new.assignee_id];
 ELSIF TG_OP='UPDATE' AND new.assignee_ids=old.assignee_ids AND new.assignee_id IS DISTINCT FROM old.assignee_id THEN new.assignee_ids=array_remove(array_replace(old.assignee_ids,old.assignee_id,new.assignee_id),NULL);IF old.assignee_id IS NULL AND new.assignee_id IS NOT NULL THEN new.assignee_ids=ARRAY[new.assignee_id];END IF;END IF;
 SELECT coalesce(array_agg(id ORDER BY first_pos),'{}') INTO new.assignee_ids FROM (SELECT id,min(pos) first_pos FROM unnest(new.assignee_ids) WITH ORDINALITY a(id,pos) WHERE id IS NOT NULL GROUP BY id) a;
 IF cardinality(new.assignee_ids)>30 THEN RAISE EXCEPTION 'Choose at most 30 assignees';END IF;
 IF TG_OP='INSERT' OR new.assignee_ids IS DISTINCT FROM old.assignee_ids THEN
 IF EXISTS(SELECT 1 FROM unnest(new.assignee_ids) a WHERE NOT public.member_active(a) OR NOT EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=new.project_id AND m.user_id=a)) THEN RAISE EXCEPTION 'Assignees must be active project members';END IF;END IF;
 new.assignee_id=new.assignee_ids[1];RETURN new;END $$;
CREATE TRIGGER a_assignment_guard BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION assignment_guard();
CREATE TRIGGER a_assignment_guard BEFORE INSERT OR UPDATE ON task_schedules FOR EACH ROW EXECUTE FUNCTION assignment_guard();
CREATE OR REPLACE FUNCTION can_work_task(t_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tasks t WHERE t.id=t_id AND NOT t.is_archived AND can_work_project(t.project_id) AND (is_admin() OR t.created_by=auth.uid() OR auth.uid()=ANY(t.assignee_ids)));
$$;
CREATE OR REPLACE FUNCTION public.task_write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL THEN
   IF new.project_id IS DISTINCT FROM old.project_id OR new.created_by IS DISTINCT FROM old.created_by THEN RAISE EXCEPTION 'Task ownership cannot be changed'; END IF;
   IF NOT public.is_admin() AND old.created_by IS DISTINCT FROM auth.uid() AND
      (to_jsonb(new)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(old)-ARRAY['status','updated_at']) AND NOT (public.can_manage_project(old.project_id) AND (to_jsonb(new)-ARRAY['assignee_id','assignee_ids','updated_at']) IS NOT DISTINCT FROM (to_jsonb(old)-ARRAY['assignee_id','assignee_ids','updated_at'])) THEN RAISE EXCEPTION 'Assignees may update status only'; END IF;
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
CREATE OR REPLACE FUNCTION public.review_task(p_task uuid,p_version bigint,p_decision text,p_reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tasks%ROWTYPE; reviewer boolean; next_status task_status; BEGIN
 PERFORM public.assert_active();SELECT * INTO t FROM tasks WHERE id=p_task FOR UPDATE;
 IF NOT FOUND OR NOT public.can_work_project(t.project_id) OR t.is_archived THEN RAISE EXCEPTION 'Task unavailable or read-only'; END IF;
 IF p_version IS NULL OR p_version<0 OR t.review_version<>p_version THEN RAISE EXCEPTION 'This task changed. Refresh before reviewing'; END IF;
 reviewer=(public.is_admin() OR t.created_by=auth.uid()) AND NOT(auth.uid()=ANY(t.assignee_ids));
 IF p_decision IN ('changes','withdraw','reopen') AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Enter a reason (1–2000 characters)'; END IF;
 IF p_decision='submit' THEN
  IF t.status IN ('done','in_review') OR cardinality(t.assignee_ids)=0 OR EXISTS(SELECT 1 FROM unnest(t.assignee_ids) a WHERE NOT public.member_active(a)) OR NOT(public.is_admin() OR auth.uid()=ANY(t.assignee_ids)) THEN RAISE EXCEPTION 'An active assignee or admin must submit assigned work'; END IF;
  IF EXISTS(SELECT 1 FROM task_checklist WHERE task_id=t.id AND NOT completed) THEN RAISE EXCEPTION 'Complete the checklist before submitting'; END IF;
  next_status='in_review';
 ELSIF p_decision IN ('approve','changes') THEN
  IF t.status<>'in_review' OR NOT reviewer OR (NOT public.review_enabled() AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Only an eligible creator or admin can review; no self-approval'; END IF;
  next_status=CASE WHEN p_decision='approve' THEN 'done'::task_status ELSE 'in_progress'::task_status END;
 ELSIF p_decision='withdraw' THEN
  IF t.status<>'in_review' OR NOT(public.is_admin() OR auth.uid()=ANY(t.assignee_ids)) THEN RAISE EXCEPTION 'Only the assignee or admin can withdraw';END IF;next_status='in_progress';
 ELSIF p_decision='reopen' THEN
  IF t.status<>'done' OR NOT(public.is_admin() OR t.created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the creator or admin can reopen';END IF;next_status='in_progress';
 ELSE RAISE EXCEPTION 'Choose a valid review action'; END IF;
 INSERT INTO task_reviews(task_id,actor_id,decision,reason,version) VALUES(t.id,auth.uid(),p_decision,coalesce(trim(p_reason),''),t.review_version);
 UPDATE tasks SET status=next_status WHERE id=t.id;
END $$;
CREATE OR REPLACE FUNCTION public.notify_review_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.decision='submit' THEN
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key)
 SELECT p.id,new.task_id,'Ready for review',t.title,new.id::text||':'||p.id::text FROM profiles p JOIN tasks t ON t.id=new.task_id
 WHERE p.is_active AND NOT(p.id=ANY(t.assignee_ids)) AND (p.role='admin' OR (public.review_enabled() AND p.id=t.created_by AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=t.project_id AND m.user_id=p.id))) ON CONFLICT DO NOTHING;
 ELSE
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key)
 SELECT a,t.id,CASE new.decision WHEN 'approve' THEN 'Task approved' WHEN 'changes' THEN 'Changes requested' WHEN 'invalidated' THEN 'Review invalidated' ELSE 'Task review updated' END,t.title||CASE WHEN new.reason<>'' THEN ' · '||new.reason ELSE '' END,new.id::text||':'||a::text FROM tasks t CROSS JOIN LATERAL unnest(t.assignee_ids) a WHERE t.id=new.task_id AND public.member_active(a) ON CONFLICT DO NOTHING;
 END IF;RETURN new;
END $$;
CREATE OR REPLACE FUNCTION record_completion_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.decision='approve' THEN INSERT INTO completion_events(review_id,task_id,project_id,task_title,assignee_id,assignee_ids,due_date,occurred_at,source) SELECT new.id,t.id,t.project_id,t.title,t.assignee_id,t.assignee_ids,t.due_date,new.created_at,'approval' FROM tasks t WHERE t.id=new.task_id; END IF;RETURN new;END $$;
CREATE OR REPLACE FUNCTION create_task_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.recurrence<>'none' THEN INSERT INTO task_schedules(task_id,project_id,created_by,title,description,priority,assignee_id,assignee_ids,frequency,anchor_date,next_run) VALUES(new.id,new.project_id,new.created_by,new.title,new.description,new.priority,new.assignee_id,new.assignee_ids,new.recurrence,new.due_date,new.next_occurrence);END IF;RETURN new;END $$;
CREATE OR REPLACE FUNCTION public.run_workspace_automation() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.task_schedules%ROWTYPE; new_id uuid; due date; n int; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 -- One runner at a time; unique occurrence and notification keys make retries safe.
 IF NOT pg_try_advisory_xact_lock(90261003) THEN RETURN; END IF;
 PERFORM public.run_archive_automation();
 FOR source IN SELECT s.* FROM task_schedules s JOIN tasks t ON t.id=s.task_id JOIN projects p ON p.id=s.project_id WHERE NOT s.paused AND s.next_run<=today AND (s.end_date IS NULL OR s.next_run<=s.end_date) AND NOT p.is_archived AND NOT t.is_archived AND public.member_active(s.created_by) AND NOT EXISTS(SELECT 1 FROM unnest(s.assignee_ids) a WHERE NOT public.member_active(a)) FOR UPDATE OF s LOOP
 due:=source.next_run;n:=0;
 WHILE due < (SELECT greatest(t.restored_at,p.restored_at)::date FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=source.task_id) LOOP due:=public.next_task_date(due,source.frequency,source.anchor_date);END LOOP;
 WHILE due<=today AND n<30 AND (source.end_date IS NULL OR due<=source.end_date) LOOP
 new_id:=NULL;
 INSERT INTO tasks(project_id,title,description,priority,status,assignee_ids,created_by,due_date,recurrence_source,occurrence_date) VALUES(source.project_id,source.title,source.description,source.priority,'todo',ARRAY(SELECT a FROM unnest(source.assignee_ids) a WHERE EXISTS(SELECT 1 FROM project_members WHERE project_id=source.project_id AND user_id=a)),source.created_by,due,source.task_id,due) ON CONFLICT(recurrence_source,occurrence_date) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NOT NULL THEN INSERT INTO task_checklist(task_id,title) SELECT new_id,title FROM task_checklist WHERE task_id=source.task_id; END IF;
 due:=public.next_task_date(due,source.frequency,source.anchor_date);n:=n+1;
 END LOOP;
 UPDATE task_schedules SET next_run=due,version=version+1 WHERE task_id=source.task_id;
 END LOOP;
 INSERT INTO public.notifications(user_id,task_id,title,message,dedupe_key)
 SELECT a,t.id,CASE WHEN t.due_date<today THEN 'Task overdue' WHEN t.due_date=today THEN 'Task due today' ELSE 'Task due tomorrow' END,
 t.title || ' · Due ' || t.due_date::text,
 t.id::text || ':' || a::text || ':' || today::text || ':deadline'
 FROM public.tasks t JOIN public.projects p ON p.id=t.project_id CROSS JOIN LATERAL unnest(t.assignee_ids) a
 WHERE public.member_active(a) AND t.status NOT IN ('done','in_review') AND NOT p.is_archived AND NOT t.is_archived AND t.due_date<=today+1
 AND EXISTS(SELECT 1 FROM public.project_members WHERE project_id=t.project_id AND user_id=a)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.set_member_active(p_member uuid,p_active boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(90261007);PERFORM public.assert_active();
 IF NOT public.is_admin() OR p_member=auth.uid() OR p_active IS NULL THEN RAISE EXCEPTION 'Another active admin is required'; END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Enter a reason (1–1000 characters)'; END IF;
 UPDATE auth.users SET disabled=NOT p_active WHERE id=p_member AND disabled=p_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member state changed. Refresh and try again'; END IF;
 INSERT INTO member_events(member_id,actor_id,action,reason) VALUES(p_member,auth.uid(),CASE WHEN p_active THEN 'reactivated' ELSE 'deactivated' END,trim(p_reason));
 -- Skip any missed recurrence dates rather than generating a backlog on resumption.
 IF p_active THEN UPDATE tasks SET next_occurrence=greatest(next_occurrence,(now() AT TIME ZONE 'Asia/Kolkata')::date+1) WHERE (p_member=ANY(assignee_ids) OR created_by=p_member) AND recurrence<>'none' AND NOT is_archived AND EXISTS(SELECT 1 FROM projects p WHERE p.id=tasks.project_id AND NOT p.is_archived); UPDATE task_schedules SET next_run=greatest(next_run,(now() AT TIME ZONE 'Asia/Kolkata')::date+1),version=version+1 WHERE p_member=ANY(assignee_ids) OR created_by=p_member; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.reassign_member_tasks(p_member uuid,p_project uuid,p_replacement uuid,p_expected jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE actual jsonb; BEGIN
 PERFORM public.assert_active();IF NOT public.is_admin() OR p_replacement=p_member THEN RAISE EXCEPTION 'Admin and another assignee required'; END IF;
 IF NOT public.can_work_project(p_project) THEN RAISE EXCEPTION 'Restore this project first'; END IF;
 IF p_replacement IS NOT NULL AND (NOT public.member_active(p_replacement) OR NOT EXISTS(SELECT 1 FROM project_members WHERE project_id=p_project AND user_id=p_replacement)) THEN RAISE EXCEPTION 'Choose an active member of this project'; END IF;
 PERFORM 1 FROM tasks WHERE project_id=p_project AND p_member=ANY(assignee_ids) AND status<>'done' AND NOT is_archived ORDER BY id FOR UPDATE;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'version',review_version) ORDER BY id),'[]'::jsonb) INTO actual FROM tasks WHERE project_id=p_project AND p_member=ANY(assignee_ids) AND status<>'done' AND NOT is_archived;
 IF actual IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Assignments changed. Refresh the preview'; END IF;
 UPDATE tasks SET assignee_ids=array_remove(array_replace(assignee_ids,p_member,p_replacement),NULL) WHERE id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(actual) v) AND p_member=ANY(assignee_ids);
 INSERT INTO member_events(member_id,actor_id,action,reason) VALUES(p_member,auth.uid(),'reassigned','Project '||p_project::text||' · '||jsonb_array_length(actual)||' tasks · replacement '||coalesce(p_replacement::text,'Unassigned'));
END $$;
CREATE OR REPLACE FUNCTION public.remove_member_and_reassign_tasks(p_project_id uuid,p_member_id uuid,p_new_assignee_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.assert_active();
 IF NOT public.can_manage_project(p_project_id) THEN RAISE EXCEPTION 'Project owner or admin required'; END IF;
 IF EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id AND created_by=p_member_id) THEN RAISE EXCEPTION 'The project owner cannot be removed'; END IF;
 IF p_new_assignee_id IS NOT NULL AND (NOT public.member_active(p_new_assignee_id) OR p_new_assignee_id=p_member_id OR NOT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=p_project_id AND user_id=p_new_assignee_id)) THEN RAISE EXCEPTION 'Choose another project member'; END IF;
 UPDATE public.tasks SET assignee_ids=array_remove(array_replace(assignee_ids,p_member_id,p_new_assignee_id),NULL) WHERE project_id=p_project_id AND p_member_id=ANY(assignee_ids) AND status<>'done' AND NOT is_archived;
 DELETE FROM public.project_members WHERE project_id=p_project_id AND user_id=p_member_id;
END $$;
CREATE OR REPLACE FUNCTION save_shared_task_schedule(p_task uuid,p_version bigint,p_title text,p_description text,p_priority task_priority,p_assignees uuid[],p_frequency text,p_next date,p_end date,p_paused boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s task_schedules%ROWTYPE;BEGIN
 PERFORM public.assert_active();SELECT * INTO s FROM task_schedules WHERE task_id=p_task FOR UPDATE;
 IF NOT FOUND OR NOT public.can_work_project(s.project_id) OR EXISTS(SELECT 1 FROM tasks WHERE id=p_task AND is_archived) OR NOT(public.is_admin() OR s.created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the creator or admin can change an active project schedule';END IF;
 IF p_version IS NULL OR s.version<>p_version THEN RAISE EXCEPTION 'This schedule changed. Reload before editing';END IF;
 IF p_frequency NOT IN ('daily','weekly','monthly') OR p_frequency IS NULL OR p_paused IS NULL OR p_next IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 200 OR p_priority IS NULL THEN RAISE EXCEPTION 'Enter a valid schedule';END IF;
 IF NOT p_paused AND (p_next<=(now() AT TIME ZONE 'Asia/Kolkata')::date OR (p_end IS NOT NULL AND p_end<p_next)) THEN RAISE EXCEPTION 'Choose a future next run within the end date';END IF;
 IF (p_assignees IS DISTINCT FROM s.assignee_ids OR NOT p_paused) AND EXISTS(SELECT 1 FROM unnest(p_assignees) a WHERE NOT public.member_active(a) OR NOT EXISTS(SELECT 1 FROM project_members WHERE project_id=s.project_id AND user_id=a)) THEN RAISE EXCEPTION 'Choose an active project member';END IF;
 UPDATE task_schedules SET title=trim(p_title),description=p_description,priority=p_priority,assignee_ids=coalesce(p_assignees,'{}'),frequency=p_frequency,anchor_date=CASE WHEN p_frequency<>frequency OR p_next<>next_run THEN p_next ELSE anchor_date END,next_run=p_next,end_date=p_end,paused=p_paused,version=version+1 WHERE task_id=p_task;
 INSERT INTO schedule_events(task_id,actor_id,description) VALUES(p_task,auth.uid(),CASE WHEN p_paused THEN 'Schedule paused' ELSE 'Future occurrences updated; next run '||p_next::text END);END $$;
REVOKE ALL ON FUNCTION save_shared_task_schedule(uuid,bigint,text,text,task_priority,uuid[],text,date,date,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION save_shared_task_schedule(uuid,bigint,text,text,task_priority,uuid[],text,date,date,boolean) TO authenticated;
CREATE FUNCTION shared_assignment_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND new.assignee_ids IS DISTINCT FROM old.assignee_ids THEN INSERT INTO task_history(task_id,actor_id,field,old_value,new_value) VALUES(new.id,auth.uid(),'assignees',array_to_string(old.assignee_ids,','),array_to_string(new.assignee_ids,','));END IF;
 IF TG_OP='INSERT' OR new.assignee_ids IS DISTINCT FROM old.assignee_ids THEN INSERT INTO notifications(user_id,task_id,title,message) SELECT a,new.id,'Task assigned',new.title FROM unnest(new.assignee_ids) a WHERE a IS DISTINCT FROM new.assignee_id AND (TG_OP='INSERT' OR NOT(a=ANY(old.assignee_ids)));END IF;RETURN new;END $$;
CREATE TRIGGER shared_assignment_history AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION shared_assignment_history();
COMMIT;
