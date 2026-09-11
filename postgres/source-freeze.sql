-- Run ONLY on the old hosted Supabase source during the approved cutover.
-- Blocks old app versions, including the old Vercel deployment, from accepting writes.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.tasktracker_cutover_readonly_20260911() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'This workspace has moved. Please use https://168.144.155.51';
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['public.profiles','public.projects','public.project_members','public.tasks','public.project_notes','public.task_comments','public.notifications','public.task_checklist','public.task_dependencies','public.task_history','public.task_attachments','auth.users','storage.objects'] LOOP
  EXECUTE format('CREATE TRIGGER tasktracker_cutover_readonly_20260911 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION public.tasktracker_cutover_readonly_20260911()',t);
 END LOOP;
END $$;
COMMIT;
SELECT count(*) AS installed_guards FROM pg_trigger WHERE tgname='tasktracker_cutover_readonly_20260911';
