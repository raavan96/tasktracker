BEGIN;
CREATE TABLE task_acknowledgements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,assigned_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,
 UNIQUE(task_id,user_id)
);
ALTER TABLE task_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY acknowledgement_read ON task_acknowledgements FOR SELECT TO authenticated USING(member_active(auth.uid()) AND EXISTS(SELECT 1 FROM tasks t WHERE t.id=task_id));
GRANT SELECT ON task_acknowledgements TO authenticated,service_role;
ALTER TABLE email_queue DROP CONSTRAINT email_queue_category_check;
ALTER TABLE email_queue ADD CONSTRAINT email_queue_category_check CHECK(category IN ('assignment','project_assignment','task_accepted','mention','review_requested','approved','changes_requested','review_updated','deadline_digest','weekly_report'));
ALTER TABLE email_queue ADD COLUMN acknowledgement_id uuid REFERENCES task_acknowledgements(id) ON DELETE SET NULL;
CREATE FUNCTION sync_task_acknowledgements() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 DELETE FROM task_acknowledgements WHERE task_id=new.id AND NOT(user_id=ANY(new.assignee_ids));
 INSERT INTO task_acknowledgements(task_id,user_id) SELECT new.id,u FROM unnest(new.assignee_ids) u ON CONFLICT(task_id,user_id) DO NOTHING;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION sync_task_acknowledgements() FROM PUBLIC;
CREATE TRIGGER sync_task_acknowledgements AFTER INSERT OR UPDATE OF assignee_ids ON tasks FOR EACH ROW EXECUTE FUNCTION sync_task_acknowledgements();
-- Existing unfinished work can be acknowledged; no historical emails are sent.
INSERT INTO task_acknowledgements(task_id,user_id) SELECT t.id,u FROM tasks t CROSS JOIN LATERAL unnest(t.assignee_ids) u WHERE t.status<>'done' AND NOT t.is_archived;
CREATE FUNCTION accept_task_assignment(receipt uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tasks%ROWTYPE;r task_acknowledgements%ROWTYPE;who text;project_title text;BEGIN
 PERFORM assert_active();
 SELECT tasks.* INTO t FROM tasks JOIN task_acknowledgements a ON a.task_id=tasks.id WHERE a.id=receipt FOR UPDATE OF tasks;
 SELECT * INTO r FROM task_acknowledgements WHERE id=receipt;
 IF t.id IS NULL OR r.id IS NULL OR r.user_id<>auth.uid() OR NOT(auth.uid()=ANY(t.assignee_ids)) OR NOT can_work_project(t.project_id) THEN RAISE EXCEPTION 'Assignment unavailable or no longer assigned to you';END IF;
 IF r.accepted_at IS NOT NULL THEN RETURN;END IF;
 IF t.is_archived OR t.status='done' THEN RAISE EXCEPTION 'Completed or archived tasks cannot be accepted';END IF;
 UPDATE task_acknowledgements SET accepted_at=now() WHERE id=receipt;
 SELECT coalesce(full_name,email) INTO who FROM profiles WHERE id=auth.uid();
 SELECT name INTO project_title FROM projects WHERE id=t.project_id;
 INSERT INTO task_history(task_id,actor_id,field,new_value) VALUES(t.id,auth.uid(),'acknowledgement',who||' accepted the task');
 INSERT INTO workspace_history(project_id,task_id,entity,entity_id,action,title,project_name,actor_id,actor_name,changes)
 VALUES(t.project_id,t.id,'Tasks',t.id,'accepted',t.title,project_title,auth.uid(),who,jsonb_build_object('acknowledgement',jsonb_build_object('before','Awaiting acceptance','after',who||' accepted')));
 IF t.created_by IS NOT NULL THEN
 INSERT INTO notifications(user_id,task_id,title,message,dedupe_key) VALUES(t.created_by,t.id,'Task accepted',who||' accepted '||t.title,'acknowledgement:'||receipt);
 IF EXISTS(SELECT 1 FROM email_delivery_settings WHERE id AND enabled) AND EXISTS(SELECT 1 FROM email_preferences WHERE user_id=t.created_by AND enabled AND assignments) AND can_email_task(t.created_by,t.id) THEN
 INSERT INTO email_queue(user_id,task_id,category,event_key,acknowledgement_id) VALUES(t.created_by,t.id,'task_accepted','acknowledgement:'||receipt,receipt) ON CONFLICT(event_key) DO NOTHING;
 END IF;END IF;
END $$;
REVOKE ALL ON FUNCTION accept_task_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_task_assignment(uuid) TO authenticated;
COMMIT;
