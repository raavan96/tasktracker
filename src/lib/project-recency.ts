// Task creation/detail edits drive recency; status, approval, archive and remarks do not.
// Runs under the caller's RLS transaction, never a service-role connection.
export const projectRecencySQL = `
 SELECT t.project_id, max(greatest(t.created_at, (
   SELECT max(h.created_at) FROM task_history h
   WHERE h.task_id=t.id AND h.field IN
     ('created','title','description','due_date','assignee_id','assignees','priority','recurrence')
 )))::text AS last_task_edit_at
 FROM tasks t GROUP BY t.project_id
`;
