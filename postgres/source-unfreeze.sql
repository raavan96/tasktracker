-- Only for a rollback BEFORE new PostgreSQL production writes are accepted.
-- If new writes exist, reconcile them first; do not silently discard them.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['public.profiles','public.projects','public.project_members','public.tasks','public.project_notes','public.task_comments','public.notifications','public.task_checklist','public.task_dependencies','public.task_history','public.task_attachments','auth.users','storage.objects'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS tasktracker_cutover_readonly_20260911 ON %s',t);
 END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.tasktracker_cutover_readonly_20260911();
COMMIT;
