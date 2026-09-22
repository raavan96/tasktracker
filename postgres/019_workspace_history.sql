BEGIN;
CREATE TABLE workspace_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL,task_id uuid,
 entity text NOT NULL,entity_id uuid,action text NOT NULL,title text NOT NULL,project_name text NOT NULL,
 actor_id uuid,actor_name text NOT NULL,changes jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_history_recent ON workspace_history(created_at DESC,id DESC);
CREATE INDEX workspace_history_project ON workspace_history(project_id,created_at DESC);
ALTER TABLE workspace_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_read ON workspace_history FOR SELECT TO authenticated USING(member_active(auth.uid()) AND (can_view_project(project_id) OR (is_admin() AND NOT EXISTS(SELECT 1 FROM projects WHERE id=project_id))));
GRANT SELECT ON workspace_history TO authenticated;
GRANT SELECT ON workspace_history TO service_role;
CREATE FUNCTION record_workspace_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_row jsonb=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(old) END;
 after_row jsonb=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(new) END;
 row_data jsonb=CASE WHEN TG_OP='DELETE' THEN to_jsonb(old) ELSE to_jsonb(new) END;
 pid uuid;tid uuid;eid uuid;heading text;project_title text;kind text;field text;fields text[];diff jsonb='{}';actor text;op text;
BEGIN
 op=CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
 IF TG_TABLE_NAME='projects' THEN
  pid=(row_data->>'id')::uuid;eid=pid;heading=row_data->>'name';project_title=heading;kind='Projects';fields=ARRAY['name','description','is_private','is_archived','completed_at'];
 ELSIF TG_TABLE_NAME IN ('project_members','project_notes') THEN
  pid=(row_data->>'project_id')::uuid;SELECT name INTO project_title FROM projects WHERE id=pid;IF NOT FOUND THEN RETURN NULL;END IF;
  eid=(row_data->>'id')::uuid;heading=project_title;kind='Projects';fields=CASE WHEN TG_TABLE_NAME='project_members' THEN ARRAY['user_id'] ELSE ARRAY['title','content'] END;
  op=CASE WHEN TG_TABLE_NAME='project_members' THEN 'membership '||op ELSE 'note '||op END;
 ELSE
  tid=CASE WHEN TG_TABLE_NAME='tasks' THEN (row_data->>'id')::uuid ELSE (row_data->>'task_id')::uuid END;
  IF TG_TABLE_NAME='tasks' THEN pid=(row_data->>'project_id')::uuid;heading=row_data->>'title';
  ELSE SELECT project_id,title INTO pid,heading FROM tasks WHERE id=tid;IF NOT FOUND THEN RETURN NULL;END IF;END IF;
  SELECT name INTO project_title FROM projects WHERE id=pid;IF NOT FOUND THEN RETURN NULL;END IF;
  eid=coalesce((row_data->>'id')::uuid,tid);
  CASE TG_TABLE_NAME
   WHEN 'tasks' THEN kind='Tasks';fields=ARRAY['title','description','status','priority','due_date','assignee_ids','is_archived','recurrence'];
   WHEN 'task_comments' THEN kind='Remarks';fields=ARRAY['content','mentions'];
   WHEN 'task_attachments' THEN kind='Attachments';fields=ARRAY['name','size'];
   WHEN 'task_reviews' THEN kind='Reviews';fields=ARRAY['decision','reason'];
   WHEN 'task_dependencies' THEN kind='Tasks';fields=ARRAY['depends_on'];op='dependency '||op;
   WHEN 'task_schedules' THEN kind='Tasks';fields=ARRAY['title','description','priority','assignee_ids','frequency','anchor_date','next_run','end_date','paused'];op='schedule '||op;
  END CASE;
 END IF;
 FOREACH field IN ARRAY fields LOOP
  IF before_row->field IS DISTINCT FROM after_row->field THEN
   diff=diff||jsonb_build_object(field,jsonb_build_object('before',before_row->field,'after',after_row->field));
  END IF;
 END LOOP;
 IF diff='{}' AND TG_OP='UPDATE' THEN RETURN NULL;END IF;
 SELECT coalesce(full_name,email) INTO actor FROM profiles WHERE id=auth.uid();
 INSERT INTO workspace_history(project_id,task_id,entity,entity_id,action,title,project_name,actor_id,actor_name,changes)
 VALUES(pid,tid,kind,eid,op,heading,project_title,auth.uid(),coalesce(actor,'System'),diff);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION record_workspace_history() FROM PUBLIC;
DO $$DECLARE tbl text;BEGIN
 FOREACH tbl IN ARRAY ARRAY['projects','project_members','project_notes','tasks','task_comments','task_attachments','task_reviews','task_dependencies','task_schedules'] LOOP
 EXECUTE format('CREATE TRIGGER workspace_history_capture AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_workspace_history()',tbl);
 END LOOP;
END $$;
-- Import only history actually recorded; never invent past project or deletion events.
INSERT INTO workspace_history(project_id,task_id,entity,entity_id,action,title,project_name,actor_id,actor_name,changes,created_at)
SELECT t.project_id,t.id,'Tasks',t.id,CASE WHEN h.field='created' THEN 'created' ELSE 'updated' END,t.title,p.name,h.actor_id,coalesce(u.full_name,u.email,'System'),jsonb_build_object(h.field,jsonb_build_object('before',h.old_value,'after',h.new_value)),h.created_at
FROM task_history h JOIN tasks t ON t.id=h.task_id JOIN projects p ON p.id=t.project_id LEFT JOIN profiles u ON u.id=h.actor_id;
INSERT INTO workspace_history(project_id,task_id,entity,entity_id,action,title,project_name,actor_id,actor_name,changes,created_at)
SELECT t.project_id,t.id,'Reviews',r.id,'created',t.title,p.name,r.actor_id,coalesce(u.full_name,u.email,'System'),jsonb_build_object('decision',jsonb_build_object('after',r.decision),'reason',jsonb_build_object('after',r.reason)),r.created_at FROM task_reviews r JOIN tasks t ON t.id=r.task_id JOIN projects p ON p.id=t.project_id LEFT JOIN profiles u ON u.id=r.actor_id;
COMMIT;
