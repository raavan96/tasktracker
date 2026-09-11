\set ON_ERROR_STOP on
CREATE TABLE members(id integer PRIMARY KEY, name text NOT NULL);
CREATE TABLE projects(id integer PRIMARY KEY, name text NOT NULL);
CREATE TABLE tasks(id integer PRIMARY KEY, project_id integer NOT NULL REFERENCES projects, assignee_id integer NOT NULL REFERENCES members, title text NOT NULL, status text NOT NULL, due_date date, updated_at timestamptz DEFAULT now());
CREATE TABLE remarks(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, task_id integer NOT NULL REFERENCES tasks, author_id integer NOT NULL REFERENCES members, content text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, task_id integer NOT NULL REFERENCES tasks, actor_id integer NOT NULL REFERENCES members, event text NOT NULL, created_at timestamptz DEFAULT now());
INSERT INTO members SELECT i, 'Synthetic member ' || i FROM generate_series(1,8) i;
INSERT INTO projects SELECT i, 'Synthetic project ' || i FROM generate_series(1,24) i;
INSERT INTO tasks SELECT i, ((i-1)%24)+1, ((i-1)%8)+1, 'Synthetic task ' || i, (ARRAY['todo','in_progress','in_review','done'])[1+i%4], current_date+(i%31)-15, now() FROM generate_series(1,10000) i;
INSERT INTO remarks(task_id,author_id,content) SELECT ((i-1)%10000)+1, ((i-1)%8)+1, repeat('Synthetic task update. ',8) FROM generate_series(1,50000) i;
INSERT INTO history(task_id,actor_id,event) SELECT ((i-1)%10000)+1, ((i-1)%8)+1, 'Synthetic status change' FROM generate_series(1,50000) i;
CREATE INDEX ON tasks(project_id,status);
CREATE INDEX ON tasks(assignee_id,due_date);
CREATE INDEX ON remarks(task_id,created_at DESC);
CREATE INDEX ON history(task_id,created_at DESC);
ANALYZE;
