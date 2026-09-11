'use client';
import { useState } from 'react';
import Link from 'next/link';
import { deadlineLabel, initials, makeCsv, matchesSummary, summaryFilters } from '@/lib/task-presentation';
export type TableTask = { id: string; project_id: string; title: string; status: string; priority: string; due_date: string | null; assignee?: { full_name: string | null; email: string } | null; project?: { name: string } | null };
export default function TaskTable({ tasks, today, onOpen, initialSummary = 'all' }: { tasks: TableTask[]; today: string; onOpen?: (id: string) => void; initialSummary?: string }) {
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState(initialSummary);
  const filtered = tasks.filter(task => matchesSummary(task, summary, today) && `${task.title} ${task.assignee?.full_name || ''} ${task.assignee?.email || ''} ${task.project?.name || ''}`.toLowerCase().includes(search.toLowerCase()));
  function download() {
    const csv = makeCsv([['Task', 'Project', 'Assignee', 'Status', 'Priority', 'Due date'], ...filtered.map(t => [t.title, t.project?.name, t.assignee?.full_name || t.assignee?.email, t.status, t.priority, t.due_date?.slice(0, 10)])]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'tasktracker-tasks.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="task-table-view space-y-4">
    <div className="flex flex-wrap gap-3">
      <input aria-label="Search task table" placeholder="Search tasks, people, projects…" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm" />
      <select aria-label="Task summary filter" value={summary} onChange={e => setSummary(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm"><option value="all">All tasks</option>{summaryFilters.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
      <button type="button" onClick={download} className="rounded-lg border px-4 py-2.5 text-sm">Export CSV</button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface">
      <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr>{['Task', 'Assignee', 'Status', 'Priority', 'Deadline'].map(h => <th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead>
        <tbody>{filtered.map(t => <tr key={t.id} className="border-t border-gray-200 hover:bg-gray-50">
          <td className="p-4 min-w-56">{onOpen ? <button onClick={() => onOpen(t.id)} className="text-left font-semibold text-blue-700">{t.title}</button> : <Link className="font-semibold text-blue-700" href={`/dashboard/projects/${t.project_id}?task=${t.id}`}>{t.title}</Link>}{t.project && <p className="mt-1 text-xs text-gray-500">{t.project.name}</p>}</td>
          <td className="p-4"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs text-blue-700">{initials(t.assignee?.full_name || t.assignee?.email || '?')}</span>{t.assignee?.full_name || t.assignee?.email || 'Unassigned'}</td>
          <td className="p-4 capitalize whitespace-nowrap"><span className="task-status-label" data-status={t.status}>{t.status.replaceAll('_', ' ')}</span></td><td className="p-4 capitalize"><span className="task-priority-label" data-priority={t.priority}>{t.priority}</span></td><td className="p-4 whitespace-nowrap">{deadlineLabel(t.due_date, t.status, today)}</td>
        </tr>)}</tbody></table>
      {!filtered.length && <p className="p-8 text-center text-gray-500">No matching tasks.</p>}
    </div><p className="text-xs text-gray-500">{filtered.length} tasks · Deadlines use India time · CSV opens in Excel</p>
  </div>;
}
