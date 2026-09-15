BEGIN;
CREATE TABLE email_delivery_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false);
INSERT INTO email_delivery_settings(id,enabled) VALUES(true,false);
ALTER TABLE email_delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_delivery_read ON email_delivery_settings FOR SELECT TO authenticated USING(member_active(auth.uid()));
GRANT SELECT ON email_delivery_settings TO authenticated; GRANT ALL ON email_delivery_settings TO service_role;
CREATE TABLE email_preferences(user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,enabled boolean NOT NULL DEFAULT false,assignments boolean NOT NULL DEFAULT true,mentions boolean NOT NULL DEFAULT true,reviews boolean NOT NULL DEFAULT true,deadline_digest boolean NOT NULL DEFAULT true);
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_email_preferences ON email_preferences TO authenticated USING(user_id=auth.uid() AND member_active(auth.uid())) WITH CHECK(user_id=auth.uid() AND member_active(auth.uid()));
GRANT SELECT,INSERT,UPDATE ON email_preferences TO authenticated; GRANT ALL ON email_preferences TO service_role;
CREATE TABLE email_queue(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('assignment','mention','review_requested','approved','changes_requested','review_updated','deadline_digest')),
 event_key text NOT NULL UNIQUE, note text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','attempting','accepted','unconfirmed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),attempted_at timestamptz,http_status integer,finished_at timestamptz,
 CHECK(category='deadline_digest' OR task_id IS NOT NULL)
);
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
-- No client read/write grants: queue contents may outlive project access.
GRANT ALL ON email_queue TO service_role;
CREATE INDEX email_queue_pending ON email_queue(created_at,id) WHERE state='pending';
CREATE FUNCTION can_email_task(p_user uuid,p_task uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM tasks t JOIN projects p ON p.id=t.project_id JOIN profiles u ON u.id=p_user WHERE t.id=p_task AND member_active(p_user) AND u.is_active AND NOT t.is_archived AND NOT p.is_archived AND (u.role='admin' OR p.created_by=p_user OR NOT p.is_private OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=p_user)));
$$;
REVOKE ALL ON FUNCTION can_email_task(uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION can_email_task(uuid,uuid) TO service_role;
CREATE FUNCTION capture_notification_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kind text; prefs email_preferences%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled) OR new.user_id=auth.uid() OR new.task_id IS NULL THEN RETURN new; END IF;
 SELECT * INTO prefs FROM email_preferences WHERE user_id=new.user_id;
 IF NOT FOUND OR NOT prefs.enabled OR NOT can_email_task(new.user_id,new.task_id) THEN RETURN new;END IF;
 kind=CASE WHEN new.title='Task assigned' AND prefs.assignments THEN 'assignment' WHEN new.dedupe_key LIKE 'mention:%' AND prefs.mentions THEN 'mention' WHEN prefs.reviews THEN CASE new.title WHEN 'Ready for review' THEN 'review_requested' WHEN 'Task approved' THEN 'approved' WHEN 'Changes requested' THEN 'changes_requested' WHEN 'Review invalidated' THEN 'review_updated' WHEN 'Task review updated' THEN 'review_updated' END END;
 IF kind IS NOT NULL THEN INSERT INTO email_queue(user_id,task_id,category,event_key,note) VALUES(new.user_id,new.task_id,kind,'notice:'||coalesce(new.dedupe_key,new.id::text),left(new.message,2000)) ON CONFLICT(event_key) DO NOTHING;END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION capture_notification_email() FROM PUBLIC;
-- BEFORE and alphabetically before respect_notification_preferences: email and
-- in-app preferences are independent, including when an in-app row is suppressed.
CREATE TRIGGER email_capture BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION capture_notification_email();
CREATE FUNCTION queue_deadline_emails(p_now timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE local_now timestamp=p_now AT TIME ZONE 'Asia/Kolkata';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled) OR local_now::time<'09:00' THEN RETURN;END IF;
 INSERT INTO email_queue(user_id,category,event_key)
 SELECT prefs.user_id,'deadline_digest','deadline:'||prefs.user_id||':'||local_now::date
 FROM email_preferences prefs WHERE prefs.enabled AND prefs.deadline_digest AND member_active(prefs.user_id)
 AND EXISTS(SELECT 1 FROM tasks t WHERE prefs.user_id=ANY(t.assignee_ids) AND t.status NOT IN ('done','in_review') AND t.due_date<=local_now::date+1 AND can_email_task(prefs.user_id,t.id))
 ON CONFLICT(event_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION queue_deadline_emails(timestamptz) FROM PUBLIC;GRANT EXECUTE ON FUNCTION queue_deadline_emails(timestamptz) TO service_role;
COMMIT;
