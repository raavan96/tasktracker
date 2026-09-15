BEGIN;
ALTER TABLE email_preferences ADD COLUMN weekly_report boolean NOT NULL DEFAULT true;
ALTER TABLE email_queue DROP CONSTRAINT email_queue_category_check;
ALTER TABLE email_queue ADD CONSTRAINT email_queue_category_check CHECK(category IN ('assignment','mention','review_requested','approved','changes_requested','review_updated','deadline_digest','weekly_report'));
ALTER TABLE email_queue DROP CONSTRAINT email_queue_check;
ALTER TABLE email_queue ADD CONSTRAINT email_queue_task_required CHECK(category IN ('deadline_digest','weekly_report') OR task_id IS NOT NULL);
CREATE FUNCTION queue_weekly_emails(p_now timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE local_now timestamp=p_now AT TIME ZONE 'Asia/Kolkata'; week_start date=date_trunc('week',local_now)::date;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled) OR local_now<week_start+time '09:00' THEN RETURN;END IF;
 INSERT INTO email_queue(user_id,category,event_key)
 SELECT prefs.user_id,'weekly_report','weekly:'||prefs.user_id||':'||week_start
 FROM email_preferences prefs JOIN profiles u ON u.id=prefs.user_id
 WHERE prefs.enabled AND prefs.weekly_report AND u.is_active AND member_active(u.id)
 AND EXISTS(SELECT 1 FROM projects p JOIN project_members m ON m.project_id=p.id WHERE m.user_id=u.id AND (NOT p.is_archived OR (p.completed_at>=(week_start-7)::timestamp AT TIME ZONE 'Asia/Kolkata' AND p.completed_at<week_start::timestamp AT TIME ZONE 'Asia/Kolkata')))
 ON CONFLICT(event_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION queue_weekly_emails(timestamptz) FROM PUBLIC;GRANT EXECUTE ON FUNCTION queue_weekly_emails(timestamptz) TO service_role;
COMMIT;
