export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type Member = { id: string; full_name: string | null; email: string; role?: string };
export type Task = {
  id: string; project_id: string; title: string; description: string | null;
  assignee_id: string | null; created_by: string; status: TaskStatus; priority: TaskPriority;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  due_date: string | null; assignee: Member | null;
  task_comments: { id: string; content: string; created_at: string; author: Member | null }[];
};

export function parseTaskForm(formData: FormData) {
  const text = (key: string) => typeof formData.get(key) === 'string' ? String(formData.get(key)).trim() : '';
  const title = text('title');
  const priority = text('priority');
  const status = text('status') || 'todo';
  const dueDate = text('dueDate');
  const recurrence = text('recurrence') || 'none';
  if (!['none', 'daily', 'weekly', 'monthly'].includes(recurrence)) return { error: 'Choose a valid repeat schedule.' } as const;
  if (recurrence !== 'none' && !dueDate) return { error: 'Recurring tasks require a due date.' } as const;
  if (!title || title.length > 200) return { error: 'Enter a task title between 1 and 200 characters.' } as const;
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) return { error: 'Choose a valid priority.' } as const;
  if (!['todo', 'in_progress', 'blocked', 'in_review', 'done'].includes(status)) return { error: 'Choose a valid status.' } as const;
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate)) return { error: 'Choose a valid due date.' } as const;
  return { data: { title, description: text('description'), assignee_id: text('assigneeId') || null, priority: priority as TaskPriority, status: status as TaskStatus, due_date: dueDate || null, recurrence } } as const;
}
