'use client';

import type { Member, Task } from '@/lib/task-types';

export default function TaskForm({ task, draft, members, busy, onSubmit, onCancel, onManageTeam }: {
  draft?: Record<string,string>|null; task?: Task | null; members: Member[]; busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isAdmin?: boolean; onCancel: () => void; onManageTeam?: (draft:Record<string,string>) => void;
}) {
  const field = 'mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm';
  return <form onSubmit={onSubmit} className="task-edit-form space-y-5">
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
      <label className="block text-sm font-medium">Title <span className="text-red-600">*</span>
        <input name="title" required maxLength={200} defaultValue={draft?.title ?? (task?.title)} placeholder="What needs to be done?" className={field} />
      </label>
      <label className="block text-sm font-medium">Description
        <textarea name="description" rows={3} defaultValue={draft?.description ?? (task?.description || '')} placeholder="Add context, expected outcome, or useful links…" className={field} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Assignee
          <select name="assigneeId" defaultValue={draft?.assigneeId ?? (task?.assignee_id || '')} className={field}>
            <option value="">Unassigned</option>
            {task?.assignee_id && !members.some(m => m.id === task.assignee_id) && <option value={task.assignee_id}>{task.assignee?.full_name||task.assignee?.email||'Previous assignee'}{task.assignee?.is_active===false?' · Inactive (current assignment)':''}</option>}
            {members.map(member => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Priority
          <select name="priority" defaultValue={draft?.priority ?? (task?.priority || 'medium')} className={field}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </label>
      </div>
      <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">Only project members appear here. {onManageTeam ? <button type="button" className="font-semibold underline underline-offset-2" onClick={e=>{const form=e.currentTarget.closest('form');if(form)onManageTeam(Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value)])));}}>Add a teammate from the Team tab</button> : 'Ask an admin to add missing teammates to this project.'}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Due date
          <input type="date" name="dueDate" defaultValue={draft?.dueDate ?? (task?.due_date?.slice(0, 10) || '')} className={field} />
        </label>
        <label className="block text-sm font-medium">Status
          <select name="status" defaultValue={draft?.status ?? (task?.status || 'todo')} className={field}>
            <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option>{task?.status==='in_review'&&<option value="in_review">Awaiting review — changes require resubmission</option>}{task?.status==='done'&&<option value="done">Completed — reopen before editing</option>}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">Repeat
        <select name="recurrence" defaultValue={draft?.recurrence ?? (task?.recurrence || 'none')} className={field}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
        <span className="block mt-1 text-xs text-gray-500">Creates the next task on its due date; checklist items are copied unchecked.</span>
      </label>
    </fieldset>
    <div className="task-form-actions flex justify-end gap-3 border-t border-slate-200 pt-5">
      <button type="button" onClick={e => { const dialog=e.currentTarget.closest('dialog'); const closeButton=dialog?.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]'); if(closeButton) closeButton.click(); else onCancel(); }} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm">Cancel</button>
      <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button>
    </div>
  </form>;
}
