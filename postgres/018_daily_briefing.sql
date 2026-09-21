BEGIN;
ALTER TABLE email_delivery_settings ADD COLUMN daily_digest_start_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date+1);
CREATE OR REPLACE FUNCTION queue_deadline_emails(p_now timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE local_now timestamp=p_now AT TIME ZONE 'Asia/Kolkata';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled AND local_now::date>=daily_digest_start_date) OR local_now::time<'11:00' THEN RETURN;END IF;
 INSERT INTO email_queue(user_id,category,event_key)
 SELECT prefs.user_id,'deadline_digest','deadline:'||prefs.user_id||':'||local_now::date
 FROM email_preferences prefs WHERE prefs.enabled AND prefs.deadline_digest AND member_active(prefs.user_id)
 AND EXISTS(SELECT 1 FROM tasks t WHERE (prefs.user_id=ANY(t.assignee_ids) OR (t.created_by=prefs.user_id AND cardinality(t.assignee_ids)>0)) AND t.status NOT IN ('done','in_review') AND t.due_date<=local_now::date+1 AND can_email_task(prefs.user_id,t.id))
 ON CONFLICT(event_key) DO NOTHING;
END $$;
COMMIT;
