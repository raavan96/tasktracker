BEGIN;
ALTER TABLE projects ADD COLUMN archived_at timestamptz, ADD COLUMN restored_at timestamptz, ADD COLUMN completed_at timestamptz;
ALTER TABLE tasks ADD COLUMN is_archived boolean NOT NULL DEFAULT false, ADD COLUMN archived_at timestamptz,
 ADD COLUMN restored_at timestamptz, ADD COLUMN completed_at timestamptz;
-- Start a conservative retention clock for older completions with uncertain dates.
UPDATE tasks SET completed_at=now() WHERE status='done';
UPDATE projects SET archived_at=now() WHERE is_archived;
CREATE INDEX task_archive_idx ON tasks(project_id,is_archived,completed_at);
CREATE TABLE archive_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id), task_days integer NOT NULL DEFAULT 30 CHECK(task_days BETWEEN 1 AND 3650), project_days integer NOT NULL DEFAULT 90 CHECK(project_days BETWEEN 1 AND 3650), tasks_enabled boolean NOT NULL DEFAULT true, projects_enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO archive_settings(id) VALUES(true);
ALTER TABLE archive_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_settings_read ON archive_settings FOR SELECT TO authenticated USING(true);
CREATE POLICY archive_settings_write ON archive_settings FOR UPDATE TO authenticated USING(is_admin()) WITH CHECK(is_admin());
GRANT SELECT,UPDATE ON archive_settings TO authenticated;
GRANT ALL ON archive_settings TO service_role;
CREATE TABLE archive_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id) ON DELETE CASCADE,task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,action text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE archive_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_event_read ON archive_events FOR SELECT TO authenticated USING(can_view_project(project_id));
GRANT SELECT ON archive_events TO authenticated;
GRANT ALL ON archive_events TO service_role;
CREATE OR REPLACE FUNCTION can_view_project(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM projects p WHERE p.id=p_id AND (is_admin() OR p.created_by=auth.uid() OR NOT p.is_private OR is_project_member(p_id)));
$$;
CREATE OR REPLACE FUNCTION can_work_task(t_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tasks t WHERE t.id=t_id AND NOT t.is_archived AND can_work_project(t.project_id) AND (is_admin() OR t.created_by=auth.uid() OR t.assignee_id=auth.uid()));
$$;
CREATE FUNCTION archive_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed boolean; BEGIN
 changed:=TG_OP='UPDATE' AND new.is_archived IS DISTINCT FROM old.is_archived;
 IF TG_TABLE_NAME='tasks' THEN
   IF new.is_archived AND new.status<>'done' THEN RAISE EXCEPTION 'Only completed tasks can be archived'; END IF;
   IF TG_OP='INSERT' OR new.status IS DISTINCT FROM old.status THEN
     new.completed_at:=CASE WHEN new.status='done' THEN now() ELSE NULL END;
   END IF;
 END IF;
 IF TG_OP='UPDATE' AND old.is_archived AND NOT changed AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Restore archived work before editing'; END IF;
 IF changed THEN
   IF (to_jsonb(new)-ARRAY['is_archived','archived_at','restored_at','updated_at','completed_at']) IS DISTINCT FROM (to_jsonb(old)-ARRAY['is_archived','archived_at','restored_at','updated_at','completed_at']) THEN RAISE EXCEPTION 'Archive or restore separately from other edits'; END IF;
   new.archived_at:=CASE WHEN new.is_archived THEN now() ELSE NULL END;
   IF NOT new.is_archived THEN new.restored_at:=now(); END IF;
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER ab_archive_lifecycle BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION archive_lifecycle();
CREATE TRIGGER ab_archive_lifecycle BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION archive_lifecycle();
CREATE FUNCTION record_archive_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF new.is_archived IS DISTINCT FROM old.is_archived THEN
   INSERT INTO archive_events(project_id,task_id,actor_id,action) VALUES(CASE WHEN TG_TABLE_NAME='tasks' THEN (to_jsonb(new)->>'project_id')::uuid ELSE new.id END,CASE WHEN TG_TABLE_NAME='tasks' THEN new.id ELSE NULL END,auth.uid(),CASE WHEN new.is_archived THEN 'archived' ELSE 'restored' END);
   IF TG_TABLE_NAME='tasks' THEN INSERT INTO task_history(task_id,actor_id,field,old_value,new_value) VALUES(new.id,auth.uid(),'archive',CASE WHEN old.is_archived THEN 'archived' ELSE 'active' END,CASE WHEN new.is_archived THEN 'archived' ELSE 'active' END); END IF;
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER record_archive_event AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION record_archive_event();
CREATE TRIGGER record_archive_event AFTER UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION record_archive_event();
-- Comment permission also checks the individual task archive state.
DROP POLICY comment_create ON task_comments;
DROP POLICY comment_delete ON task_comments;
CREATE POLICY comment_create ON task_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND EXISTS(SELECT 1 FROM tasks WHERE id=task_id AND NOT is_archived AND can_work_project(project_id)));
CREATE POLICY comment_delete ON task_comments FOR DELETE TO authenticated USING((author_id=auth.uid() OR is_admin()) AND EXISTS(SELECT 1 FROM tasks WHERE id=task_id AND NOT is_archived AND can_work_project(project_id)));
CREATE FUNCTION archive_project_content_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid; tid uuid; rowdata jsonb; BEGIN
 rowdata:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(old) ELSE to_jsonb(new) END;
 IF TG_TABLE_NAME IN ('tasks','project_notes','project_members') THEN pid:=(rowdata->>'project_id')::uuid;
 ELSE tid:=(rowdata->>'task_id')::uuid; SELECT project_id INTO pid FROM tasks WHERE id=tid; END IF;
 IF auth.uid() IS NOT NULL THEN
   IF EXISTS(SELECT 1 FROM projects WHERE id=pid AND is_archived) THEN RAISE EXCEPTION 'Restore the project before making changes'; END IF;
   IF tid IS NOT NULL AND EXISTS(SELECT 1 FROM tasks WHERE id=tid AND is_archived) THEN RAISE EXCEPTION 'Restore the task before making changes'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END $$;
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['tasks','project_notes','project_members','task_comments','task_checklist','task_dependencies','task_attachments'] LOOP
 EXECUTE format('CREATE TRIGGER a0_archive_content_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION archive_project_content_guard()',tbl);
 END LOOP;
END $$;
CREATE FUNCTION set_archive(p_kind text,p_id uuid,p_archived boolean,p_confirm_unfinished boolean DEFAULT false,p_complete boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p projects%ROWTYPE; t tasks%ROWTYPE; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to archive or restore work'; END IF;
 IF p_kind='project' THEN
   SELECT * INTO p FROM projects WHERE id=p_id FOR UPDATE;
   IF p.id IS NULL OR NOT can_manage_project(p.id) THEN RAISE EXCEPTION 'Only the project creator or admin can archive or restore this project'; END IF;
   IF p_archived AND NOT p_confirm_unfinished AND EXISTS(SELECT 1 FROM tasks WHERE project_id=p.id AND status<>'done') THEN RAISE EXCEPTION 'This project has unfinished tasks. Confirm to pause and archive the whole project'; END IF;
   IF p_complete AND (NOT p_archived OR NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=p.id) OR EXISTS(SELECT 1 FROM tasks WHERE project_id=p.id AND status<>'done')) THEN RAISE EXCEPTION 'Complete every task before completing the project'; END IF;
   UPDATE projects SET is_archived=p_archived,completed_at=CASE WHEN p_complete THEN now() ELSE NULL END WHERE id=p.id AND is_archived<>p_archived;
 ELSE
   IF p_kind<>'task' THEN RAISE EXCEPTION 'Invalid archive type'; END IF;
   SELECT * INTO p FROM projects WHERE id=(SELECT project_id FROM tasks WHERE id=p_id) FOR UPDATE;
   SELECT * INTO t FROM tasks WHERE id=p_id FOR UPDATE;
   IF t.id IS NULL OR NOT can_view_project(p.id) OR NOT (is_admin() OR t.created_by=auth.uid()) THEN RAISE EXCEPTION 'Only the task creator or admin can archive or restore this task'; END IF;
   IF p.is_archived THEN RAISE EXCEPTION 'Restore the project first'; END IF;
   UPDATE tasks SET is_archived=p_archived WHERE id=t.id AND is_archived<>p_archived;
 END IF;
END $$;
REVOKE ALL ON FUNCTION set_archive(text,uuid,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION set_archive(text,uuid,boolean,boolean,boolean) TO authenticated;
CREATE FUNCTION bulk_archive_tasks(p_project_id uuid,p_days integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record; n integer:=0; BEGIN
 IF auth.uid() IS NULL OR p_days NOT BETWEEN 1 AND 3650 OR NOT can_work_project(p_project_id) THEN RAISE EXCEPTION 'Choose an active project and valid age'; END IF;
 PERFORM 1 FROM projects WHERE id=p_project_id FOR UPDATE;
 FOR t IN SELECT id FROM tasks WHERE project_id=p_project_id AND NOT is_archived AND status='done' AND recurrence='none' AND greatest(completed_at,restored_at)<=now()-make_interval(days=>p_days) AND (is_admin() OR created_by=auth.uid()) FOR UPDATE LOOP
   PERFORM set_archive('task',t.id,true,false); n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION bulk_archive_tasks(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION bulk_archive_tasks(uuid,integer) TO authenticated;
CREATE FUNCTION run_archive_automation() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg archive_settings%ROWTYPE; p projects%ROWTYPE; BEGIN
 IF NOT pg_try_advisory_xact_lock(90261004) THEN RETURN; END IF;
 SELECT * INTO cfg FROM archive_settings WHERE id=true;
 FOR p IN SELECT * FROM projects WHERE NOT is_archived ORDER BY id FOR UPDATE LOOP
  IF cfg.tasks_enabled THEN
    UPDATE tasks SET is_archived=true WHERE project_id=p.id AND NOT is_archived AND status='done' AND recurrence='none' AND greatest(completed_at,restored_at)<=now()-make_interval(days=>cfg.task_days);
  END IF;
  IF cfg.projects_enabled AND EXISTS(SELECT 1 FROM tasks WHERE project_id=p.id)
    AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=p.id AND (status<>'done' OR recurrence<>'none' OR greatest(completed_at,restored_at)>now()-make_interval(days=>cfg.project_days)))
    AND greatest(p.updated_at,p.restored_at)<=now()-make_interval(days=>cfg.project_days) THEN
    UPDATE projects SET is_archived=true WHERE id=p.id;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION run_archive_automation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION run_archive_automation() TO service_role;
CREATE OR REPLACE FUNCTION public.run_workspace_automation() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.tasks%ROWTYPE; new_id uuid; due date; n int; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 -- One runner at a time; unique occurrence and notification keys make retries safe.
 IF NOT pg_try_advisory_xact_lock(90261003) THEN RETURN; END IF;
 PERFORM public.run_archive_automation();
 FOR source IN SELECT t.* FROM public.tasks t JOIN public.projects p ON p.id=t.project_id WHERE t.recurrence<>'none' AND t.next_occurrence<=today AND NOT p.is_archived AND NOT t.is_archived AND t.created_by IS NOT NULL FOR UPDATE OF t LOOP
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
 WHERE t.assignee_id IS NOT NULL AND t.status NOT IN ('done','in_review') AND NOT p.is_archived AND NOT t.is_archived AND t.due_date<=today+1
 AND EXISTS(SELECT 1 FROM public.project_members WHERE project_id=t.project_id AND user_id=t.assignee_id)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END $$;

COMMIT;
