BEGIN;
CREATE INDEX tasks_project_created_page_idx ON tasks(project_id,created_at DESC,id);
CREATE INDEX tasks_assignee_due_page_idx ON tasks(assignee_id,due_date,id) WHERE NOT is_archived;
CREATE INDEX comments_task_page_idx ON task_comments(task_id,created_at DESC,id);
CREATE INDEX task_history_page_idx ON task_history(task_id,created_at DESC,id);
ALTER TABLE task_comments ADD COLUMN mentions uuid[] NOT NULL DEFAULT '{}', ADD COLUMN edit_version bigint NOT NULL DEFAULT 0, ADD COLUMN edited_at timestamptz;
CREATE TABLE remark_edits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),comment_id uuid NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,content text NOT NULL,mentions uuid[] NOT NULL,edited_by uuid REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE remark_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY remark_edits_read ON remark_edits FOR SELECT TO authenticated USING(public.member_active(auth.uid()) AND EXISTS(SELECT 1 FROM tasks WHERE id=task_id AND public.can_view_project(project_id)));
GRANT SELECT ON remark_edits TO authenticated;GRANT ALL ON remark_edits TO service_role;
CREATE POLICY comment_update ON task_comments FOR UPDATE TO authenticated USING(author_id=auth.uid() AND EXISTS(SELECT 1 FROM tasks WHERE id=task_id AND NOT is_archived AND public.can_work_project(project_id))) WITH CHECK(author_id=auth.uid() AND EXISTS(SELECT 1 FROM tasks WHERE id=task_id AND NOT is_archived AND public.can_work_project(project_id)));
CREATE FUNCTION remark_edit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE project uuid; BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM public.assert_active(); END IF;
 SELECT project_id INTO project FROM tasks WHERE id=new.task_id;
 IF length(trim(new.content)) NOT BETWEEN 1 AND 10000 OR cardinality(new.mentions)>30 THEN RAISE EXCEPTION 'Enter a remark up to 10,000 characters and at most 30 mentions';END IF;
 IF TG_OP='UPDATE' THEN
 IF new.task_id<>old.task_id OR new.author_id<>old.author_id OR (auth.uid() IS NOT NULL AND old.author_id<>auth.uid()) THEN RAISE EXCEPTION 'Only the author can edit this remark';END IF;
 IF new.content IS DISTINCT FROM old.content OR new.mentions IS DISTINCT FROM old.mentions THEN
 INSERT INTO remark_edits(comment_id,task_id,content,mentions,edited_by) VALUES(old.id,old.task_id,old.content,old.mentions,auth.uid());new.edited_at=now();END IF;
 new.edit_version=old.edit_version+1;
 ELSE new.edit_version=0; END IF;
 IF EXISTS(SELECT 1 FROM unnest(new.mentions) x WHERE NOT EXISTS(SELECT 1 FROM profiles p WHERE p.id=x AND p.is_active AND (p.role='admin' OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=project AND m.user_id=x)))) THEN RAISE EXCEPTION 'Mentions must be active teammates with project access';END IF;
 RETURN new;END $$;
CREATE TRIGGER remark_edit_guard BEFORE INSERT OR UPDATE ON task_comments FOR EACH ROW EXECUTE FUNCTION remark_edit_guard();
CREATE FUNCTION notify_mentions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key)
 SELECT DISTINCT x,new.task_id,'You were mentioned',left(new.content,300),'mention:'||new.id||':'||new.edit_version||':'||x FROM unnest(new.mentions) x WHERE x<>new.author_id AND (TG_OP='INSERT' OR NOT x=ANY(old.mentions)) ON CONFLICT DO NOTHING;
 RETURN new;END $$;
CREATE TRIGGER notify_mentions AFTER INSERT OR UPDATE ON task_comments FOR EACH ROW EXECUTE FUNCTION notify_mentions();
CREATE TABLE completion_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid UNIQUE REFERENCES task_reviews(id) ON DELETE CASCADE,task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,task_title text NOT NULL,assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,due_date date,occurred_at timestamptz NOT NULL,source text NOT NULL CHECK(source IN ('approval','legacy_review','legacy_estimated')));
ALTER TABLE completion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY completion_events_read ON completion_events FOR SELECT TO authenticated USING(public.member_active(auth.uid()) AND public.can_view_project(project_id));
GRANT SELECT ON completion_events TO authenticated;GRANT ALL ON completion_events TO service_role;
CREATE INDEX completion_events_period_idx ON completion_events(occurred_at,task_id);
INSERT INTO completion_events(review_id,task_id,project_id,task_title,occurred_at,source) SELECT r.id,t.id,t.project_id,t.title,r.created_at,'legacy_review' FROM task_reviews r JOIN tasks t ON t.id=r.task_id WHERE r.decision='approve';
INSERT INTO completion_events(task_id,project_id,task_title,occurred_at,source) SELECT t.id,t.project_id,t.title,coalesce(t.completed_at,t.updated_at),'legacy_estimated' FROM tasks t WHERE t.status='done' AND NOT EXISTS(SELECT 1 FROM completion_events e WHERE e.task_id=t.id);
CREATE FUNCTION record_completion_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.decision='approve' THEN INSERT INTO completion_events(review_id,task_id,project_id,task_title,assignee_id,due_date,occurred_at,source) SELECT new.id,t.id,t.project_id,t.title,t.assignee_id,t.due_date,new.created_at,'approval' FROM tasks t WHERE t.id=new.task_id; END IF;RETURN new;END $$;
CREATE TRIGGER record_completion_event AFTER INSERT ON task_reviews FOR EACH ROW EXECUTE FUNCTION record_completion_event();
CREATE TABLE task_schedules(task_id uuid PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,created_by uuid REFERENCES profiles(id),title text NOT NULL,description text,priority task_priority NOT NULL,assignee_id uuid REFERENCES profiles(id),frequency text NOT NULL CHECK(frequency IN ('daily','weekly','monthly')),anchor_date date NOT NULL,next_run date NOT NULL,end_date date,paused boolean NOT NULL DEFAULT false,version bigint NOT NULL DEFAULT 0);
CREATE TABLE schedule_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,actor_id uuid REFERENCES profiles(id),description text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE task_schedules ENABLE ROW LEVEL SECURITY;ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedules_read ON task_schedules FOR SELECT TO authenticated USING(public.member_active(auth.uid()) AND public.can_view_project(project_id));
CREATE POLICY schedule_events_read ON schedule_events FOR SELECT TO authenticated USING(public.member_active(auth.uid()) AND EXISTS(SELECT 1 FROM tasks WHERE id=task_id AND public.can_view_project(project_id)));
GRANT SELECT ON task_schedules,schedule_events TO authenticated;GRANT ALL ON task_schedules,schedule_events TO service_role;
INSERT INTO task_schedules(task_id,project_id,created_by,title,description,priority,assignee_id,frequency,anchor_date,next_run) SELECT id,project_id,created_by,title,description,priority,assignee_id,recurrence,due_date,coalesce(next_occurrence,public.next_task_date(due_date,recurrence,due_date)) FROM tasks WHERE recurrence<>'none';
CREATE FUNCTION create_task_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.recurrence<>'none' THEN INSERT INTO task_schedules(task_id,project_id,created_by,title,description,priority,assignee_id,frequency,anchor_date,next_run) VALUES(new.id,new.project_id,new.created_by,new.title,new.description,new.priority,new.assignee_id,new.recurrence,new.due_date,new.next_occurrence);END IF;RETURN new;END $$;
CREATE TRIGGER create_task_schedule AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION create_task_schedule();
CREATE FUNCTION save_task_schedule(p_task uuid,p_version bigint,p_title text,p_description text,p_priority task_priority,p_assignee uuid,p_frequency text,p_next date,p_end date,p_paused boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s task_schedules%ROWTYPE;BEGIN
 PERFORM public.assert_active();SELECT * INTO s FROM task_schedules WHERE task_id=p_task FOR UPDATE;
 IF NOT FOUND OR NOT public.can_work_project(s.project_id) OR EXISTS(SELECT 1 FROM tasks WHERE id=p_task AND is_archived) OR NOT(public.is_admin() OR s.created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the creator or admin can change an active project schedule';END IF;
 IF p_version IS NULL OR s.version<>p_version THEN RAISE EXCEPTION 'This schedule changed. Reload before editing';END IF;
 IF p_frequency NOT IN ('daily','weekly','monthly') OR p_frequency IS NULL OR p_paused IS NULL OR p_next IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 200 OR p_priority IS NULL THEN RAISE EXCEPTION 'Enter a valid schedule';END IF;
 IF NOT p_paused AND (p_next<=(now() AT TIME ZONE 'Asia/Kolkata')::date OR (p_end IS NOT NULL AND p_end<p_next)) THEN RAISE EXCEPTION 'Choose a future next run within the end date';END IF;
 IF p_assignee IS NOT NULL AND (p_assignee IS DISTINCT FROM s.assignee_id OR NOT p_paused) AND (NOT public.member_active(p_assignee) OR NOT EXISTS(SELECT 1 FROM project_members WHERE project_id=s.project_id AND user_id=p_assignee)) THEN RAISE EXCEPTION 'Choose an active project member';END IF;
 UPDATE task_schedules SET title=trim(p_title),description=p_description,priority=p_priority,assignee_id=p_assignee,frequency=p_frequency,anchor_date=CASE WHEN p_frequency<>frequency OR p_next<>next_run THEN p_next ELSE anchor_date END,next_run=p_next,end_date=p_end,paused=p_paused,version=version+1 WHERE task_id=p_task;
 INSERT INTO schedule_events(task_id,actor_id,description) VALUES(p_task,auth.uid(),CASE WHEN p_paused THEN 'Schedule paused' ELSE 'Future occurrences updated; next run '||p_next::text END);END $$;
REVOKE ALL ON FUNCTION save_task_schedule(uuid,bigint,text,text,task_priority,uuid,text,date,date,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION save_task_schedule(uuid,bigint,text,text,task_priority,uuid,text,date,date,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.run_workspace_automation() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.task_schedules%ROWTYPE; new_id uuid; due date; n int; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 -- One runner at a time; unique occurrence and notification keys make retries safe.
 IF NOT pg_try_advisory_xact_lock(90261003) THEN RETURN; END IF;
 PERFORM public.run_archive_automation();
 FOR source IN SELECT s.* FROM task_schedules s JOIN tasks t ON t.id=s.task_id JOIN projects p ON p.id=s.project_id WHERE NOT s.paused AND s.next_run<=today AND (s.end_date IS NULL OR s.next_run<=s.end_date) AND NOT p.is_archived AND NOT t.is_archived AND public.member_active(s.created_by) AND (s.assignee_id IS NULL OR public.member_active(s.assignee_id)) FOR UPDATE OF s LOOP
 due:=source.next_run;n:=0;
 WHILE due < (SELECT greatest(t.restored_at,p.restored_at)::date FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=source.task_id) LOOP due:=public.next_task_date(due,source.frequency,source.anchor_date);END LOOP;
 WHILE due<=today AND n<30 AND (source.end_date IS NULL OR due<=source.end_date) LOOP
 new_id:=NULL;
 INSERT INTO tasks(project_id,title,description,priority,status,assignee_id,created_by,due_date,recurrence_source,occurrence_date) VALUES(source.project_id,source.title,source.description,source.priority,'todo',CASE WHEN EXISTS(SELECT 1 FROM project_members WHERE project_id=source.project_id AND user_id=source.assignee_id) THEN source.assignee_id ELSE NULL END,source.created_by,due,source.task_id,due) ON CONFLICT(recurrence_source,occurrence_date) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NOT NULL THEN INSERT INTO task_checklist(task_id,title) SELECT new_id,title FROM task_checklist WHERE task_id=source.task_id; END IF;
 due:=public.next_task_date(due,source.frequency,source.anchor_date);n:=n+1;
 END LOOP;
 UPDATE task_schedules SET next_run=due,version=version+1 WHERE task_id=source.task_id;
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
CREATE OR REPLACE FUNCTION public.set_member_active(p_member uuid,p_active boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(90261007);PERFORM public.assert_active();
 IF NOT public.is_admin() OR p_member=auth.uid() OR p_active IS NULL THEN RAISE EXCEPTION 'Another active admin is required'; END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Enter a reason (1–1000 characters)'; END IF;
 UPDATE auth.users SET disabled=NOT p_active WHERE id=p_member AND disabled=p_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member state changed. Refresh and try again'; END IF;
 INSERT INTO member_events(member_id,actor_id,action,reason) VALUES(p_member,auth.uid(),CASE WHEN p_active THEN 'reactivated' ELSE 'deactivated' END,trim(p_reason));
 -- Skip any missed recurrence dates rather than generating a backlog on resumption.
 IF p_active THEN UPDATE tasks SET next_occurrence=greatest(next_occurrence,(now() AT TIME ZONE 'Asia/Kolkata')::date+1) WHERE (assignee_id=p_member OR created_by=p_member) AND recurrence<>'none' AND NOT is_archived AND EXISTS(SELECT 1 FROM projects p WHERE p.id=tasks.project_id AND NOT p.is_archived); UPDATE task_schedules SET next_run=greatest(next_run,(now() AT TIME ZONE 'Asia/Kolkata')::date+1),version=version+1 WHERE assignee_id=p_member OR created_by=p_member; END IF;
END $$;

CREATE FUNCTION protect_task_recurrence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF auth.uid() IS NOT NULL AND new.recurrence IS DISTINCT FROM old.recurrence THEN RAISE EXCEPTION 'Use future schedule controls; existing tasks are unchanged';END IF;RETURN new;END $$;
CREATE TRIGGER protect_task_recurrence BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION protect_task_recurrence();
CREATE INDEX projects_search_idx ON projects USING gin(to_tsvector('simple',coalesce(name,'')||' '||coalesce(description,'')));
CREATE INDEX tasks_search_idx ON tasks USING gin(to_tsvector('simple',coalesce(title,'')||' '||coalesce(description,'')));
CREATE INDEX notes_search_idx ON project_notes USING gin(to_tsvector('simple',title||' '||content));
CREATE INDEX remarks_search_idx ON task_comments USING gin(to_tsvector('simple',content));
COMMIT;
