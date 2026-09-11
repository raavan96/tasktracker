\set member random(1,8)
\set project random(1,24)
\set task random(1,10000)
\set write random(1,5)
BEGIN;
SELECT status,count(*) FROM tasks WHERE assignee_id=:member GROUP BY status;
SELECT t.id,t.title,t.status,t.due_date,m.name FROM tasks t JOIN members m ON m.id=t.assignee_id WHERE t.project_id=:project ORDER BY t.due_date,t.id LIMIT 50;
SELECT content,created_at FROM remarks WHERE task_id=:task ORDER BY created_at DESC LIMIT 30;
SELECT event,created_at FROM history WHERE task_id=:task ORDER BY created_at DESC LIMIT 30;
\if :write = 1
UPDATE tasks SET updated_at=now() WHERE id=:task;
INSERT INTO history(task_id,actor_id,event) VALUES(:task,:member,'Synthetic benchmark update');
INSERT INTO remarks(task_id,author_id,content) VALUES(:task,:member,'Synthetic benchmark remark');
\endif
COMMIT;
