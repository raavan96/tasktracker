BEGIN;
CREATE TABLE workspace_preferences (
 user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 landing_page text NOT NULL DEFAULT '/dashboard' CHECK(landing_page IN ('/dashboard','/dashboard/insights','/dashboard/my-tasks','/dashboard/tasks','/dashboard/calendar'))
);
ALTER TABLE workspace_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_workspace_preferences ON workspace_preferences TO authenticated
 USING(user_id=auth.uid() AND public.member_active(auth.uid()))
 WITH CHECK(user_id=auth.uid() AND public.member_active(auth.uid()));
GRANT SELECT,INSERT,UPDATE ON workspace_preferences TO authenticated;
GRANT ALL ON workspace_preferences TO service_role;

CREATE TABLE project_favorites (
 user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,project_id)
);
ALTER TABLE project_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_project_favorites ON project_favorites TO authenticated
 USING(user_id=auth.uid() AND public.member_active(auth.uid()) AND public.can_view_project(project_id))
 WITH CHECK(user_id=auth.uid() AND public.member_active(auth.uid()) AND public.can_view_project(project_id));
GRANT SELECT,INSERT,DELETE ON project_favorites TO authenticated;
GRANT ALL ON project_favorites TO service_role;
COMMIT;
