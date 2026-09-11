BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text, ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT true;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
 ADD COLUMN IF NOT EXISTS next_occurrence date,
 ADD COLUMN IF NOT EXISTS recurrence_source uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS occurrence_date date;
CREATE UNIQUE INDEX IF NOT EXISTS task_occurrence_unique ON public.tasks(recurrence_source, occurrence_date);
CREATE INDEX IF NOT EXISTS task_project_idx ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS task_assignee_due_idx ON public.tasks(assignee_id,due_date);
CREATE INDEX IF NOT EXISTS task_comment_idx ON public.task_comments(task_id,created_at);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id,is_read);

CREATE OR REPLACE FUNCTION public.can_manage_project(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_admin() OR EXISTS(SELECT 1 FROM public.projects WHERE id=p_id AND created_by=auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.can_view_project(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_id AND
 (public.is_admin() OR p.created_by=auth.uid() OR (NOT p.is_archived AND (NOT p.is_private OR public.is_project_member(p_id)))));
$$;
CREATE OR REPLACE FUNCTION public.can_work_project(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_id AND NOT p.is_archived AND
 (public.is_admin() OR p.created_by=auth.uid() OR public.is_project_member(p_id)));
$$;
CREATE OR REPLACE FUNCTION public.can_work_task(t_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=t_id AND public.can_work_project(t.project_id) AND
 (public.is_admin() OR t.created_by=auth.uid() OR t.assignee_id=auth.uid()));
$$;

-- Replace the inspected policies on these tables; avoid permissive policy overlap.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('projects','project_members','tasks','project_notes','task_comments','profiles') LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
END $$;
CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated USING(true);
CREATE POLICY profile_admin_update ON public.profiles FOR UPDATE TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY project_read ON public.projects FOR SELECT TO authenticated USING(created_by=auth.uid() OR public.can_view_project(id));
CREATE POLICY project_create ON public.projects FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid());
CREATE POLICY project_update ON public.projects FOR UPDATE TO authenticated USING(public.can_manage_project(id)) WITH CHECK(public.can_manage_project(id));
CREATE POLICY project_delete ON public.projects FOR DELETE TO authenticated USING(public.can_manage_project(id));
CREATE POLICY membership_read ON public.project_members FOR SELECT TO authenticated USING(public.can_view_project(project_id));
CREATE POLICY membership_write ON public.project_members FOR ALL TO authenticated USING(public.can_manage_project(project_id)) WITH CHECK(public.can_manage_project(project_id));
CREATE POLICY task_read ON public.tasks FOR SELECT TO authenticated USING(public.can_view_project(project_id));
CREATE POLICY task_create ON public.tasks FOR INSERT TO authenticated WITH CHECK(public.can_work_project(project_id) AND created_by=auth.uid());
CREATE POLICY task_update ON public.tasks FOR UPDATE TO authenticated USING(public.can_work_task(id)) WITH CHECK(public.can_work_task(id));
CREATE POLICY task_delete ON public.tasks FOR DELETE TO authenticated USING(public.can_view_project(project_id) AND (public.is_admin() OR created_by=auth.uid()));
CREATE POLICY note_read ON public.project_notes FOR SELECT TO authenticated USING(public.can_view_project(project_id));
CREATE POLICY note_create ON public.project_notes FOR INSERT TO authenticated WITH CHECK(public.can_work_project(project_id) AND author_id=auth.uid());
CREATE POLICY note_update ON public.project_notes FOR UPDATE TO authenticated USING(public.can_work_project(project_id) AND (public.is_admin() OR author_id=auth.uid())) WITH CHECK(public.can_work_project(project_id) AND (public.is_admin() OR author_id=auth.uid()));
CREATE POLICY note_delete ON public.project_notes FOR DELETE TO authenticated USING(public.can_work_project(project_id) AND (public.is_admin() OR author_id=auth.uid()));
CREATE POLICY comment_read ON public.task_comments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.tasks WHERE id=task_id AND public.can_view_project(project_id)));
CREATE POLICY comment_create ON public.task_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND EXISTS(SELECT 1 FROM public.tasks WHERE id=task_id AND public.can_work_project(project_id)));
CREATE POLICY comment_delete ON public.task_comments FOR DELETE TO authenticated USING((author_id=auth.uid() OR public.is_admin()) AND EXISTS(SELECT 1 FROM public.tasks WHERE id=task_id AND public.can_work_project(project_id)));

-- Do not trust a signup's user-editable metadata for admin role assignment.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF lower(split_part(new.email,'@',2)) <> 'collegedunia.com' THEN RAISE EXCEPTION 'Company email required'; END IF;
 INSERT INTO public.profiles(id,email,full_name,role) VALUES(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'member')
 ON CONFLICT(id) DO UPDATE SET email=excluded.email, updated_at=now();
 RETURN new;
END $$;
CREATE OR REPLACE FUNCTION public.project_owner_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF new.created_by IS DISTINCT FROM old.created_by AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Project owner cannot be changed'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER project_owner_guard BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.project_owner_guard();
CREATE OR REPLACE FUNCTION public.add_project_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.project_members(project_id,user_id) VALUES(new.id,new.created_by) ON CONFLICT(project_id,user_id) DO NOTHING;
 RETURN new;
END $$;
CREATE TRIGGER add_project_owner AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.add_project_owner();
INSERT INTO public.project_members(project_id,user_id) SELECT id,created_by FROM public.projects WHERE created_by IS NOT NULL ON CONFLICT DO NOTHING;

CREATE TABLE public.task_checklist (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300), completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.task_dependencies (
 task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 depends_on uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 PRIMARY KEY(task_id,depends_on), CHECK(task_id<>depends_on)
);
CREATE TABLE public.task_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, field text NOT NULL,
 old_value text, new_value text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.task_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 name text NOT NULL, storage_path text NOT NULL UNIQUE, size bigint NOT NULL CHECK(size BETWEEN 1 AND 10485760),
 created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['task_checklist','task_dependencies','task_history','task_attachments'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY read_project ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks WHERE id=task_id AND public.can_view_project(project_id)))',t);
 END LOOP;
END $$;
CREATE POLICY checklist_write ON public.task_checklist FOR ALL TO authenticated USING(public.can_work_task(task_id)) WITH CHECK(public.can_work_task(task_id));
CREATE POLICY dependency_write ON public.task_dependencies FOR ALL TO authenticated USING(public.can_work_task(task_id)) WITH CHECK(public.can_work_task(task_id));
CREATE POLICY attachment_create ON public.task_attachments FOR INSERT TO authenticated WITH CHECK(public.can_work_task(task_id) AND uploaded_by=auth.uid() AND split_part(storage_path,'/',1)=task_id::text);
CREATE POLICY attachment_delete ON public.task_attachments FOR DELETE TO authenticated USING(public.can_work_task(task_id) AND (uploaded_by=auth.uid() OR public.is_admin()));
CREATE INDEX task_history_task_idx ON public.task_history(task_id,created_at);

CREATE OR REPLACE FUNCTION public.checklist_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tasks WHERE id=new.task_id AND status='done') THEN RAISE EXCEPTION 'Reopen the task before changing its checklist'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER checklist_guard BEFORE INSERT OR UPDATE ON public.task_checklist FOR EACH ROW EXECUTE FUNCTION public.checklist_guard();

CREATE OR REPLACE FUNCTION public.dependency_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p uuid; other_p uuid; BEGIN
 IF EXISTS(SELECT 1 FROM public.tasks WHERE id=new.task_id AND status='done') THEN RAISE EXCEPTION 'Reopen the task before adding dependencies'; END IF;
 SELECT project_id INTO p FROM public.tasks WHERE id=new.task_id;
 SELECT project_id INTO other_p FROM public.tasks WHERE id=new.depends_on;
 IF p IS DISTINCT FROM other_p THEN RAISE EXCEPTION 'Dependencies must be in the same project'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p::text,0));
 IF EXISTS(WITH RECURSIVE chain(id) AS (SELECT new.depends_on UNION SELECT d.depends_on FROM public.task_dependencies d JOIN chain c ON d.task_id=c.id) SELECT 1 FROM chain WHERE id=new.task_id) THEN RAISE EXCEPTION 'This dependency would create a cycle'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER dependency_guard BEFORE INSERT OR UPDATE ON public.task_dependencies FOR EACH ROW EXECUTE FUNCTION public.dependency_guard();

CREATE OR REPLACE FUNCTION public.task_write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL THEN
   IF new.project_id IS DISTINCT FROM old.project_id OR new.created_by IS DISTINCT FROM old.created_by THEN RAISE EXCEPTION 'Task ownership cannot be changed'; END IF;
   IF NOT public.is_admin() AND old.created_by IS DISTINCT FROM auth.uid() AND
      (to_jsonb(new)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(old)-ARRAY['status','updated_at']) AND NOT (public.can_manage_project(old.project_id) AND (to_jsonb(new)-ARRAY['assignee_id','updated_at']) IS NOT DISTINCT FROM (to_jsonb(old)-ARRAY['assignee_id','updated_at'])) THEN RAISE EXCEPTION 'Assignees may update status only'; END IF;
 END IF;
 IF new.status='done' AND (TG_OP='INSERT' OR old.status IS DISTINCT FROM new.status) THEN
   IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'Submit for review; only admins can approve completion'; END IF;
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
CREATE TRIGGER aa_task_write_guard BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.task_write_guard();
CREATE OR REPLACE FUNCTION public.record_task_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f text; BEGIN
 IF TG_OP='INSERT' THEN INSERT INTO public.task_history(task_id,actor_id,field,new_value) VALUES(new.id,auth.uid(),'created',new.title);
 ELSE FOREACH f IN ARRAY ARRAY['title','description','due_date','assignee_id','priority','status','recurrence'] LOOP
 IF to_jsonb(old)->f IS DISTINCT FROM to_jsonb(new)->f THEN INSERT INTO public.task_history(task_id,actor_id,field,old_value,new_value) VALUES(new.id,auth.uid(),f,to_jsonb(old)->>f,to_jsonb(new)->>f); END IF;
 END LOOP; END IF;
 RETURN new;
END $$;
CREATE TRIGGER record_task_history AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.record_task_history();

CREATE OR REPLACE FUNCTION public.create_workspace_project(p_name text,p_description text,p_members uuid[],p_private boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p uuid; BEGIN
 IF auth.uid() IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Sign in and enter a project name (1–200 characters)'; END IF;
 INSERT INTO public.projects(name,description,created_by,is_private) VALUES(trim(p_name),p_description,auth.uid(),p_private) RETURNING id INTO p;
 INSERT INTO public.project_members(project_id,user_id) SELECT p,unnest(p_members) ON CONFLICT DO NOTHING;
 RETURN p;
END $$;
CREATE OR REPLACE FUNCTION public.remove_member_and_reassign_tasks(p_project_id uuid,p_member_id uuid,p_new_assignee_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.can_manage_project(p_project_id) THEN RAISE EXCEPTION 'Project owner or admin required'; END IF;
 IF EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id AND created_by=p_member_id) THEN RAISE EXCEPTION 'The project owner cannot be removed'; END IF;
 IF p_new_assignee_id IS NOT NULL AND (p_new_assignee_id=p_member_id OR NOT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=p_project_id AND user_id=p_new_assignee_id)) THEN RAISE EXCEPTION 'Choose another project member'; END IF;
 UPDATE public.tasks SET assignee_id=p_new_assignee_id WHERE project_id=p_project_id AND assignee_id=p_member_id;
 DELETE FROM public.project_members WHERE project_id=p_project_id AND user_id=p_member_id;
END $$;

COMMIT;
