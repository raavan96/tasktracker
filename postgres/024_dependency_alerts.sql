BEGIN;

ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS email_queue_category_check;
ALTER TABLE email_queue ADD CONSTRAINT email_queue_category_check CHECK(category IN ('assignment','project_assignment','task_accepted','mention','review_requested','approved','changes_requested','review_updated','deadline_digest','weekly_report','dependency_unblocked'));

CREATE OR REPLACE FUNCTION public.capture_notification_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kind text; prefs email_preferences%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled) OR new.user_id=auth.uid() OR new.task_id IS NULL THEN RETURN new; END IF;
 SELECT * INTO prefs FROM email_preferences WHERE user_id=new.user_id;
 IF NOT FOUND OR NOT prefs.enabled OR NOT can_email_task(new.user_id,new.task_id) THEN RETURN new;END IF;
 kind=CASE
   WHEN new.title='Task assigned' AND prefs.assignments THEN 'assignment'
   WHEN new.title='Dependency unblocked' AND prefs.assignments THEN 'dependency_unblocked'
   WHEN new.dedupe_key LIKE 'mention:%' AND prefs.mentions THEN 'mention'
   WHEN prefs.reviews THEN CASE new.title WHEN 'Ready for review' THEN 'review_requested' WHEN 'Task approved' THEN 'approved' WHEN 'Changes requested' THEN 'changes_requested' WHEN 'Review invalidated' THEN 'review_updated' WHEN 'Task review updated' THEN 'review_updated' END
 END;
 IF kind IS NOT NULL THEN INSERT INTO email_queue(user_id,task_id,category,event_key,note) VALUES(new.user_id,new.task_id,kind,'notice:'||coalesce(new.dedupe_key,new.id::text),left(new.message,2000)) ON CONFLICT(event_key) DO NOTHING;END IF;
 RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.notify_dependency_unblocked() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  downstream RECORD;
  target uuid;
  who text;
BEGIN
  IF new.status = 'done' AND (TG_OP = 'INSERT' OR old.status IS DISTINCT FROM 'done') THEN
    FOR downstream IN
      SELECT t.id, t.project_id, t.title, t.status, t.assignee_ids, t.created_by
      FROM public.task_dependencies d
      JOIN public.tasks t ON t.id = d.task_id
      JOIN public.projects p ON p.id = t.project_id
      WHERE d.depends_on = new.id
        AND NOT t.is_archived
        AND NOT p.is_archived
        AND t.status <> 'done'
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.task_dependencies d2
        JOIN public.tasks t2 ON t2.id = d2.depends_on
        WHERE d2.task_id = downstream.id
          AND t2.status <> 'done'
      ) THEN
        IF downstream.status = 'blocked' THEN
          UPDATE public.tasks SET status = 'todo' WHERE id = downstream.id;
        END IF;

        SELECT coalesce(full_name, email) INTO who FROM public.profiles WHERE id = auth.uid();
        INSERT INTO public.task_history(task_id, actor_id, field, old_value, new_value)
        VALUES(downstream.id, auth.uid(), 'dependency', 'blocked', 'Unblocked: prerequisite "' || new.title || '" completed');

        FOR target IN
          SELECT unnest(downstream.assignee_ids)
          UNION
          SELECT downstream.created_by WHERE cardinality(downstream.assignee_ids) = 0
        LOOP
          IF public.member_active(target) THEN
            INSERT INTO public.notifications(user_id, task_id, title, message, dedupe_key)
            VALUES(
              target,
              downstream.id,
              'Dependency unblocked',
              downstream.title || ' is ready to start (prerequisite "' || new.title || '" was completed)',
              'unblocked:' || downstream.id::text || ':' || new.id::text || ':' || target::text
            ) ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS notify_dependency_unblocked ON public.tasks;
CREATE TRIGGER notify_dependency_unblocked AFTER UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_dependency_unblocked();

CREATE OR REPLACE FUNCTION public.check_dependency_removal_unblock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  downstream RECORD;
  target uuid;
  who text;
BEGIN
  SELECT t.id, t.project_id, t.title, t.status, t.assignee_ids, t.created_by
  INTO downstream
  FROM public.tasks t
  JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = old.task_id
    AND NOT t.is_archived
    AND NOT p.is_archived
    AND t.status <> 'done';

  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.task_dependencies d2
      JOIN public.tasks t2 ON t2.id = d2.depends_on
      WHERE d2.task_id = downstream.id
        AND t2.status <> 'done'
    ) THEN
      IF downstream.status = 'blocked' THEN
        UPDATE public.tasks SET status = 'todo' WHERE id = downstream.id;
      END IF;

      SELECT coalesce(full_name, email) INTO who FROM public.profiles WHERE id = auth.uid();
      INSERT INTO public.task_history(task_id, actor_id, field, old_value, new_value)
      VALUES(downstream.id, auth.uid(), 'dependency', 'blocked', 'Unblocked: blocking prerequisite removed');

      FOR target IN
        SELECT unnest(downstream.assignee_ids)
        UNION
        SELECT downstream.created_by WHERE cardinality(downstream.assignee_ids) = 0
      LOOP
        IF public.member_active(target) THEN
          INSERT INTO public.notifications(user_id, task_id, title, message, dedupe_key)
          VALUES(
            target,
            downstream.id,
            'Dependency unblocked',
            downstream.title || ' is ready to start (prerequisites removed or completed)',
            'unblocked:removed:' || downstream.id::text || ':' || old.depends_on::text || ':' || target::text
          ) ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN old;
END $$;

DROP TRIGGER IF EXISTS check_dependency_removal_unblock ON public.task_dependencies;
CREATE TRIGGER check_dependency_removal_unblock AFTER DELETE ON public.task_dependencies FOR EACH ROW EXECUTE FUNCTION public.check_dependency_removal_unblock();

COMMIT;
