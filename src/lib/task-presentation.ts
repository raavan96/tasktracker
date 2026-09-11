export const WORKSPACE_TIMEZONE = 'Asia/Kolkata';
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: WORKSPACE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function deadlineLabel(due: string | null, status: string, today: string) {
  if (!due) return 'No deadline';
  const date = due.slice(0, 10);
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  if (status === 'done') return `Due ${date}`;
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}
export function initials(name: string) {
  return name.trim().split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}
export type SummaryTask = { status: string; due_date: string | null };
export function matchesSummary(task: SummaryTask, filter: string, today: string) {
  const due = task.due_date?.slice(0, 10);
  if (filter === 'overdue') return task.status !== 'done' && !!due && due < today;
  if (filter === 'today') return task.status !== 'done' && due === today;
  if (filter === 'in_progress') return task.status === 'in_progress';
  if (filter === 'in_review') return task.status === 'in_review';
  if (filter === 'done') return task.status === 'done';
  return true;
}
export const summaryFilters = [
  { id: 'overdue', label: 'Overdue' }, { id: 'today', label: 'Due today' },
  { id: 'in_progress', label: 'In progress' }, { id: 'in_review', label: 'Awaiting review' }, { id: 'done', label: 'Completed' },
];
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  // Excel interprets these prefixes as formulas even inside quoted CSV cells.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function makeCsv(rows: unknown[][]) {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
