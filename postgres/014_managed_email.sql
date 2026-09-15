BEGIN;
-- Workspace-managed subscription. Delivery still checks account and project access.
ALTER TABLE email_preferences ALTER COLUMN enabled SET DEFAULT true;
INSERT INTO email_preferences(user_id,enabled,assignments,mentions,reviews,deadline_digest,weekly_report)
SELECT id,true,true,true,true,true,true FROM profiles
ON CONFLICT(user_id) DO UPDATE SET enabled=true,assignments=true,mentions=true,reviews=true,deadline_digest=true,weekly_report=true;
REVOKE INSERT,UPDATE,DELETE ON email_preferences FROM authenticated;
DROP POLICY own_email_preferences ON email_preferences;
CREATE POLICY own_email_preferences ON email_preferences FOR SELECT TO authenticated USING(user_id=auth.uid() AND member_active(auth.uid()));
CREATE FUNCTION subscribe_workspace_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO email_preferences(user_id,enabled) VALUES(new.id,true) ON CONFLICT(user_id) DO NOTHING;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION subscribe_workspace_member() FROM PUBLIC;
CREATE TRIGGER subscribe_workspace_member AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION subscribe_workspace_member();
COMMIT;
