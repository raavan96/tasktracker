BEGIN;
-- Personal snapshots remain tied to the source project's access and lifetime.
CREATE TABLE planning_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 source_project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 blueprint jsonb NOT NULL CHECK(jsonb_typeof(blueprint)='object' AND octet_length(blueprint::text)<=524288),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX planning_templates_owner ON planning_templates(created_by,created_at DESC);
ALTER TABLE planning_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_template_read ON planning_templates FOR SELECT TO authenticated
 USING(created_by=auth.uid() AND can_view_project(source_project_id));
CREATE POLICY planning_template_create ON planning_templates FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND can_view_project(source_project_id));
CREATE POLICY planning_template_delete ON planning_templates FOR DELETE TO authenticated USING(created_by=auth.uid());
GRANT SELECT,INSERT,DELETE ON planning_templates TO authenticated;
-- A retry after a dropped connection must return the original result, never copy twice.
CREATE TABLE planning_requests (
 created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, payload_hash text NOT NULL,
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(created_by,request_id)
);
ALTER TABLE planning_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_request_read ON planning_requests FOR SELECT TO authenticated USING(created_by=auth.uid());
CREATE POLICY planning_request_create ON planning_requests FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND can_work_project(project_id));
GRANT SELECT,INSERT ON planning_requests TO authenticated;
CREATE POLICY active_account ON planning_templates AS RESTRICTIVE FOR ALL TO authenticated USING(member_active(auth.uid())) WITH CHECK(member_active(auth.uid()));
CREATE POLICY active_account ON planning_requests AS RESTRICTIVE FOR ALL TO authenticated USING(member_active(auth.uid())) WITH CHECK(member_active(auth.uid()));
CREATE INDEX task_calendar_due ON tasks(due_date,project_id,id) WHERE NOT is_archived;
COMMIT;
