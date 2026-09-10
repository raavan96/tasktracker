BEGIN;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX notification_dedupe ON public.notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.next_task_date(d date,frequency text,anchor date) RETURNS date LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE frequency WHEN 'daily' THEN d+1 WHEN 'weekly' THEN d+7 WHEN 'monthly' THEN
 (date_trunc('month',d)+interval '1 month')::date + (least(extract(day from anchor)::int, extract(day from (date_trunc('month',d)+interval '2 months - 1 day'))::int)-1) ELSE NULL END;
$$;
CREATE OR REPLACE FUNCTION public.run_workspace_automation() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.tasks%ROWTYPE; new_id uuid; due date; n int; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 -- One runner at a time; unique occurrence and notification keys make retries safe.
 IF NOT pg_try_advisory_xact_lock(90261003) THEN RETURN; END IF;
 FOR source IN SELECT t.* FROM public.tasks t JOIN public.projects p ON p.id=t.project_id WHERE t.recurrence<>'none' AND t.next_occurrence<=today AND NOT p.is_archived AND t.created_by IS NOT NULL FOR UPDATE OF t LOOP
   due:=source.next_occurrence; n:=0;
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
 WHERE t.assignee_id IS NOT NULL AND t.status NOT IN ('done','in_review') AND NOT p.is_archived AND t.due_date<=today+1
 AND EXISTS(SELECT 1 FROM public.project_members WHERE project_id=t.project_id AND user_id=t.assignee_id)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.run_workspace_automation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_workspace_automation() TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.task_checklist,public.task_dependencies,public.task_attachments TO authenticated,service_role;
GRANT SELECT ON public.task_history TO authenticated;
GRANT ALL ON public.task_history TO service_role;
CREATE OR REPLACE FUNCTION public.notify_task_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF old.status IS DISTINCT FROM new.status AND new.status='in_review' THEN
 INSERT INTO public.notifications(user_id,task_id,title,message)
 SELECT id,new.id,'Ready for review',new.title FROM public.profiles WHERE role='admin';
 ELSIF old.status='in_review' AND new.status IN ('in_progress','done') AND new.assignee_id IS NOT NULL THEN
 INSERT INTO public.notifications(user_id,task_id,title,message) VALUES(new.assignee_id,new.id,CASE WHEN new.status='done' THEN 'Task approved' ELSE 'Changes requested' END,new.title);
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER notify_task_review AFTER UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_review();
COMMIT;
