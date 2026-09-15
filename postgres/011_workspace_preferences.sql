BEGIN;
CREATE TABLE saved_task_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 60), filters jsonb NOT NULL CHECK(jsonb_typeof(filters)='object' AND octet_length(filters::text)<=4000),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,name)
);
ALTER TABLE saved_task_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_saved_views ON saved_task_views TO authenticated USING(user_id=auth.uid() AND public.member_active(auth.uid())) WITH CHECK(user_id=auth.uid() AND public.member_active(auth.uid()));
GRANT SELECT,INSERT,UPDATE,DELETE ON saved_task_views TO authenticated;
GRANT ALL ON saved_task_views TO service_role;
CREATE TABLE notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 deadline_days smallint NOT NULL DEFAULT 1 CHECK(deadline_days IN (0,1,3,7)),
 mentions boolean NOT NULL DEFAULT true, assignments boolean NOT NULL DEFAULT true, reviews boolean NOT NULL DEFAULT true
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notification_preferences ON notification_preferences TO authenticated USING(user_id=auth.uid() AND public.member_active(auth.uid())) WITH CHECK(user_id=auth.uid() AND public.member_active(auth.uid()));
GRANT SELECT,INSERT,UPDATE ON notification_preferences TO authenticated;
GRANT ALL ON notification_preferences TO service_role;
CREATE INDEX deadline_preference_lookup ON notifications(user_id,task_id,created_at DESC) WHERE dedupe_key LIKE '%:deadline';
CREATE FUNCTION respect_notification_preferences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prefs notification_preferences%ROWTYPE;
BEGIN
 SELECT * INTO prefs FROM notification_preferences WHERE user_id=new.user_id;
 IF NOT FOUND THEN RETURN new; END IF;
 IF new.dedupe_key LIKE '%:deadline' THEN
  IF prefs.deadline_days=0 THEN RETURN NULL; END IF;
  -- Limit reminders per task; other tasks can still notify immediately.
  IF prefs.deadline_days>1 AND EXISTS(SELECT 1 FROM notifications WHERE user_id=new.user_id AND task_id=new.task_id AND dedupe_key LIKE '%:deadline' AND created_at>now()-make_interval(days=>prefs.deadline_days)) THEN RETURN NULL; END IF;
 ELSIF new.dedupe_key LIKE 'mention:%' AND NOT prefs.mentions THEN RETURN NULL;
 ELSIF new.title='Task assigned' AND NOT prefs.assignments THEN RETURN NULL;
 ELSIF new.title IN ('Ready for review','Task approved','Changes requested','Review invalidated','Task review updated') AND NOT prefs.reviews THEN RETURN NULL;
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION respect_notification_preferences() FROM PUBLIC;
CREATE TRIGGER respect_notification_preferences BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION respect_notification_preferences();
COMMIT;
