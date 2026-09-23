BEGIN;
CREATE TABLE chat_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid UNIQUE REFERENCES projects(id) ON DELETE CASCADE,user_a uuid REFERENCES profiles(id) ON DELETE CASCADE,user_b uuid REFERENCES profiles(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),CHECK((project_id IS NOT NULL AND user_a IS NULL AND user_b IS NULL) OR (project_id IS NULL AND user_a IS NOT NULL AND user_b IS NOT NULL AND user_a<user_b)),UNIQUE(user_a,user_b));
CREATE TABLE chat_messages(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,author_id uuid NOT NULL REFERENCES profiles(id),body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),reply_id bigint REFERENCES chat_messages(id) ON DELETE SET NULL,mentions uuid[] NOT NULL DEFAULT '{}',nonce uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(author_id,nonce));
CREATE INDEX chat_messages_conversation ON chat_messages(conversation_id,id DESC);
CREATE TABLE chat_reads(conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,last_id bigint NOT NULL DEFAULT 0,PRIMARY KEY(conversation_id,user_id));
ALTER TABLE notifications ADD COLUMN chat_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN chat_message_id bigint REFERENCES chat_messages(id) ON DELETE CASCADE;
CREATE FUNCTION chat_allowed(cid uuid,uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT member_active(uid) AND EXISTS(SELECT 1 FROM chat_conversations c WHERE c.id=cid AND ((c.project_id IS NULL AND uid IN(c.user_a,c.user_b)) OR EXISTS(SELECT 1 FROM projects p WHERE p.id=c.project_id AND (p.created_by=uid OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=uid)))));
$$;
REVOKE ALL ON FUNCTION chat_allowed(uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION chat_allowed(uuid,uuid) TO authenticated;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_view ON chat_conversations FOR SELECT TO authenticated USING(chat_allowed(id,auth.uid()));
CREATE POLICY chat_message_view ON chat_messages FOR SELECT TO authenticated USING(chat_allowed(conversation_id,auth.uid()));
CREATE POLICY chat_read_view ON chat_reads FOR SELECT TO authenticated USING(user_id=auth.uid() AND chat_allowed(conversation_id,auth.uid()));
GRANT SELECT ON chat_conversations,chat_messages,chat_reads TO authenticated;
CREATE FUNCTION open_chat(project uuid,person uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid;u uuid=auth.uid();BEGIN
 IF NOT member_active(u) OR (project IS NULL)=(person IS NULL) THEN RAISE EXCEPTION 'Invalid chat request';END IF;
 IF project IS NOT NULL THEN
 IF NOT EXISTS(SELECT 1 FROM projects p WHERE p.id=project AND NOT p.is_archived AND (p.created_by=u OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=u))) THEN RAISE EXCEPTION 'Project chat unavailable';END IF;
 INSERT INTO chat_conversations(project_id) VALUES(project) ON CONFLICT(project_id) DO UPDATE SET project_id=excluded.project_id RETURNING id INTO cid;
 ELSE
 IF person=u OR NOT member_active(person) THEN RAISE EXCEPTION 'Member unavailable';END IF;
 INSERT INTO chat_conversations(user_a,user_b) VALUES(least(u,person),greatest(u,person)) ON CONFLICT(user_a,user_b) DO UPDATE SET user_a=excluded.user_a RETURNING id INTO cid;
 END IF;RETURN cid;END $$;
CREATE FUNCTION send_chat(cid uuid,content text,reply bigint,mentioned uuid[],request_id uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid=auth.uid();c chat_conversations%ROWTYPE;mid bigint;old chat_messages%ROWTYPE;recipient uuid;label text;BEGIN
 IF NOT chat_allowed(cid,u) OR request_id IS NULL OR length(btrim(content)) NOT BETWEEN 1 AND 4000 OR content IS NULL OR cardinality(mentioned)>30 THEN RAISE EXCEPTION 'Invalid message or chat unavailable';END IF;
 SELECT * INTO c FROM chat_conversations WHERE id=cid FOR UPDATE;
 SELECT * INTO old FROM chat_messages WHERE author_id=u AND nonce=request_id;
 IF FOUND THEN IF old.conversation_id<>cid OR old.body<>btrim(content) OR old.reply_id IS DISTINCT FROM reply OR old.mentions IS DISTINCT FROM coalesce(mentioned,'{}') THEN RAISE EXCEPTION 'Retry does not match original message';END IF;RETURN old.id;END IF;
 IF c.project_id IS NOT NULL AND EXISTS(SELECT 1 FROM projects WHERE id=c.project_id AND is_archived) THEN RAISE EXCEPTION 'Archived project chat is read-only';END IF;
 IF c.project_id IS NULL AND (NOT member_active(c.user_a) OR NOT member_active(c.user_b)) THEN RAISE EXCEPTION 'Member unavailable';END IF;
 IF reply IS NOT NULL AND NOT EXISTS(SELECT 1 FROM chat_messages WHERE id=reply AND conversation_id=cid) THEN RAISE EXCEPTION 'Reply unavailable';END IF;
 IF EXISTS(SELECT 1 FROM unnest(mentioned) person WHERE NOT chat_allowed(cid,person)) THEN RAISE EXCEPTION 'Mentioned member cannot access this chat';END IF;
 IF (SELECT count(*) FROM chat_messages WHERE author_id=u AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'Please wait a moment before sending more messages';END IF;
 INSERT INTO chat_messages(conversation_id,author_id,body,reply_id,mentions,nonce) VALUES(cid,u,btrim(content),reply,coalesce(mentioned,'{}'),request_id) RETURNING id INTO mid;
 SELECT coalesce(full_name,email) INTO label FROM profiles WHERE id=u;
 FOR recipient IN SELECT p.id FROM profiles p WHERE p.id<>u AND chat_allowed(cid,p.id) LOOP
 INSERT INTO notifications(user_id,title,message,chat_id,chat_message_id,dedupe_key) VALUES(recipient,CASE WHEN recipient=ANY(coalesce(mentioned,'{}')) THEN 'Chat mention' ELSE 'Chat message' END,label||' sent a message',cid,mid,'chat:'||mid||':'||recipient);
 END LOOP;RETURN mid;END $$;
CREATE FUNCTION read_chat(cid uuid,upto bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT chat_allowed(cid,auth.uid()) OR NOT EXISTS(SELECT 1 FROM chat_messages WHERE id=upto AND conversation_id=cid) THEN RAISE EXCEPTION 'Chat unavailable';END IF;
 INSERT INTO chat_reads(conversation_id,user_id,last_id) VALUES(cid,auth.uid(),upto) ON CONFLICT(conversation_id,user_id) DO UPDATE SET last_id=greatest(chat_reads.last_id,excluded.last_id);
 UPDATE notifications SET is_read=true WHERE user_id=auth.uid() AND chat_id=cid AND chat_message_id<=upto;
 END $$;
REVOKE ALL ON FUNCTION open_chat(uuid,uuid),send_chat(uuid,text,bigint,uuid[],uuid),read_chat(uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION open_chat(uuid,uuid),send_chat(uuid,text,bigint,uuid[],uuid),read_chat(uuid,bigint) TO authenticated;
COMMIT;
