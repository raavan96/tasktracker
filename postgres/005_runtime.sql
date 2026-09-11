-- The web process is not a database owner or superuser. The adapter enters an
-- RLS role inside each transaction; auth tables are server-only, never exposed.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='tasktracker_runtime') THEN
   CREATE ROLE tasktracker_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT authenticated,service_role TO tasktracker_runtime;
GRANT USAGE ON SCHEMA auth TO tasktracker_runtime,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON auth.users,auth.sessions,auth.login_attempts TO tasktracker_runtime,service_role;
CREATE UNIQUE INDEX auth_users_email_ci ON auth.users(lower(email));
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN new.updated_at=now(); RETURN new; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','projects','tasks','project_notes','task_comments'] LOOP
 EXECUTE format('CREATE TRIGGER zz_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',t);
END LOOP; END $$;
CREATE FUNCTION public.notify_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF new.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR new.assignee_id IS DISTINCT FROM old.assignee_id) THEN
 INSERT INTO notifications(user_id,task_id,title,message) VALUES(new.assignee_id,new.id,'Task assigned',new.title);
 END IF; RETURN new;
END $$;
CREATE TRIGGER notify_assignment AFTER INSERT OR UPDATE OF assignee_id ON tasks FOR EACH ROW EXECUTE FUNCTION notify_assignment();
-- Functions invoked through the runtime do not permit clients to grant roles.
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC,authenticated,anon;
