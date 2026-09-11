-- Standalone staging schema. Apply only to a NEW, empty database as its migration owner.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE TYPE public.user_role AS ENUM('admin','member');
CREATE TYPE public.task_status AS ENUM('todo','in_progress','blocked','done');
CREATE TYPE public.task_priority AS ENUM('low','medium','high','urgent');
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb, password_hash text, disabled boolean NOT NULL DEFAULT false);
CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,email text NOT NULL UNIQUE,full_name text,role user_role NOT NULL DEFAULT 'member',avatar_url text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,description text,is_archived boolean NOT NULL DEFAULT false,created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE project_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,joined_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,user_id));
CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title text NOT NULL,description text,status task_status NOT NULL DEFAULT 'todo',priority task_priority NOT NULL DEFAULT 'medium',assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,due_date date,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE project_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,title text NOT NULL,content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE task_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,title text NOT NULL,message text NOT NULL,is_read boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin') $$;
CREATE FUNCTION is_project_member(p_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM project_members WHERE project_id=p_id AND user_id=auth.uid()) $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','projects','project_members','tasks','project_notes','task_comments','notifications'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
CREATE TABLE auth.sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE INDEX sessions_user_idx ON auth.sessions(user_id);
CREATE INDEX sessions_expiry_idx ON auth.sessions(expires_at);
CREATE TABLE auth.login_attempts(key text PRIMARY KEY,attempts integer NOT NULL,window_start timestamptz NOT NULL);
CREATE POLICY notifications_read ON notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE(is_read) ON notifications TO authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

