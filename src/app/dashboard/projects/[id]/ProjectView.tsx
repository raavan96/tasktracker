'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TaskExtras from '@/components/TaskExtras';
import TaskTable from '@/components/TaskTable';
import { deadlineLabel, initials } from '@/lib/task-presentation';
import DeleteConfirmation from '@/components/DeleteConfirmation';
import Modal from '@/components/Modal';
import TaskForm from '@/components/TaskForm';
import type { Task, Member } from '@/lib/task-types';
import {
  createTask,
  updateTask,
  updateTaskStatus,
  addComment,
  deleteTask,
} from '@/app/dashboard/tasks/actions';
import { createNote, deleteNote } from '@/app/dashboard/notes/actions';
import {
  addProjectMember,
  deleteProject,
  updateProject,
  removeProjectMember
} from '@/app/dashboard/projects/actions';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Plus,
  Trash2,
  MessageSquare,
  Calendar,
  StickyNote,
  Users,
  Send,
  Pencil
} from 'lucide-react';

export default function ProjectView({
  project,
  tasks,
  notes,
  members,
  allWorkspaceUsers,
  currentUserId,
  isAdmin, today, initialTaskId = null,
}: {
  project: { id: string; name: string; description: string | null; is_archived: boolean; created_by: string | null; is_private: boolean };
  tasks: Task[]; notes: { id: string; title: string; content: string; author_id: string; updated_at: string; author: Member | null }[];
  members: Member[]; allWorkspaceUsers: Member[]; currentUserId: string; isAdmin: boolean; today: string; initialTaskId?: string | null;
}) {
  const router = useRouter();
  const [editingProject, setEditingProject] = useState(false);
  const [view, setView] = useState<'board' | 'table'>('board');
  const [mobileStatus, setMobileStatus] = useState('all');
  const canManage = isAdmin || project.created_by === currentUserId;
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'task' | 'project'; id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes' | 'members'>('tasks');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId);
  const selectedTask = tasks.find(task => task.id === selectedTaskId) || null;
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string } | null>(null);
  const [newMemberId, setNewMemberId] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');

  const statusColumns = [
    { id: 'todo', title: 'To Do', icon: Circle, color: 'text-gray-500 bg-gray-100' },
    { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { id: 'blocked', title: 'Blocked', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    { id: 'in_review', title: 'Ready for review', icon: Clock, color: 'text-purple-700 bg-purple-50' },
    { id: 'done', title: 'Done', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  ];

  async function runAction(action: () => Promise<{ error?: string; success?: unknown }>, message: string) {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const result = await action();
      if (result.error) { setFeedback({ error: result.error }); return false; }
      setFeedback({ success: message });
      return true;
    } catch {
      setFeedback({ error: 'Something went wrong. Your changes have not been confirmed. Please try again.' });
      return false;
    } finally { setIsSubmitting(false); }
  }

  async function handleSaveTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const saved = await runAction(() => editingTask ? updateTask(editingTask.id, project.id, formData) : createTask(project.id, formData), editingTask ? 'Task updated.' : 'Task created.');
    if (saved) { setIsTaskModalOpen(false); setEditingTask(null); }
  }

  async function handleCreateNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (await runAction(() => createNote(project.id, formData), 'Note saved.')) setIsNoteModalOpen(false);
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || !selectedTask) return;
    if (await runAction(() => addComment(selectedTask.id, project.id, commentInput), 'Update posted.')) setCommentInput('');
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return;
    if (await runAction(() => removeProjectMember(project.id, memberToRemove.id, reassignTo || undefined), 'Teammate removed and tasks reassigned.')) {
      setMemberToRemove(null); setReassignTo('');
    }
  }

  const errorNotice = feedback?.error ? <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{feedback.error}</div> : null;

  return (
    <div className="space-y-6">
      {errorNotice}
      {feedback?.success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{feedback.success}</div>}
      {/* Project Header */}
      <div className="bg-surface border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.is_archived && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                  Archived
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{project.description || 'No description provided.'}</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canManage && <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setEditingProject(true)}>Edit project</button>}
            {canManage && <button type="button" onClick={() => { setFeedback(null); setDeleteTarget({ kind: 'project', id: project.id, name: project.name }); }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete project</button>}
            {activeTab === 'tasks' && (isAdmin || members.some((m: Member) => m.id === currentUserId)) && (
              <button
                onClick={() => { setFeedback(null); setEditingTask(null); setIsTaskModalOpen(true); }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Task
              </button>
            )}
            {activeTab === 'notes' && (canManage || members.some(m => m.id === currentUserId)) && (
              <button
                onClick={() => { setFeedback(null); setIsNoteModalOpen(true); }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> New Note
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mt-6 border-b border-gray-100 text-sm font-medium">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 px-1 border-b-2 flex items-center ${
              activeTab === 'tasks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-3 px-1 border-b-2 flex items-center ${
              activeTab === 'notes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <StickyNote className="w-4 h-4 mr-1.5" /> Notes ({notes.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 px-1 border-b-2 flex items-center ${
              activeTab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 mr-1.5" /> Team ({members.length})
          </button>
        </div>
      </div>

      {/* TAB 1: TASKS BOARD */}
      {activeTab === 'tasks' && <div className="flex gap-2"><button aria-pressed={view === 'board'} onClick={() => setView('board')} className="rounded-lg border px-4 py-2 text-sm"><span className="md:hidden">Tasks</span><span className="hidden md:inline">Board</span></button><button aria-pressed={view === 'table'} onClick={() => setView('table')} className="rounded-lg border px-4 py-2 text-sm">Table & export</button></div>}
      {activeTab === 'tasks' && view === 'table' && <TaskTable tasks={tasks} today={today} onOpen={id => { setSelectedTaskId(id); setFeedback(null); }} />}
      {activeTab === 'tasks' && view === 'board' && <label className="block md:hidden text-sm font-medium">Filter by status<select value={mobileStatus} onChange={e=>setMobileStatus(e.target.value)} className="mt-2 w-full rounded-lg border p-3"><option value="all">All tasks ({tasks.length})</option>{statusColumns.map(col=><option key={col.id} value={col.id}>{col.title} ({tasks.filter(t=>t.status===col.id).length})</option>)}</select></label>}
      {activeTab === 'tasks' && view === 'board' && !tasks.length && <p className="md:hidden rounded-xl border p-6 text-sm text-gray-500">No tasks yet. Add a task to get started.</p>}
      {activeTab === 'tasks' && view === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {statusColumns.map((col) => {
            const columnTasks = tasks.filter((t: Task) => t.status === col.id);
            const Icon = col.icon;

            return (
              <div key={col.id} className={`bg-gray-100/70 p-3 md:p-4 rounded-xl flex-col md:min-h-36 lg:h-[65vh] ${((mobileStatus === 'all' && !columnTasks.length) || (mobileStatus !== 'all' && mobileStatus !== col.id)) ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center space-x-2">
                    <span className={`p-1 rounded-md ${col.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-semibold text-sm text-gray-800">{col.title}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-semibold bg-surface px-2 py-0.5 rounded-full border border-gray-200">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {columnTasks.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">No tasks {col.id === 'done' ? 'completed yet' : 'here yet'}</p>}
                  {columnTasks.map((task: Task) => (
                    <div
                      key={task.id}
                      role="button" tabIndex={0}
                      aria-label={`Open task: ${task.title}`}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTaskId(task.id); setFeedback(null); setCommentInput(''); } }}
                      onClick={() => { setSelectedTaskId(task.id); setFeedback(null); setCommentInput(''); }}
                      className="bg-surface p-4 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition cursor-pointer space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-base font-semibold text-gray-900 leading-snug">{task.title}</h4>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          task.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {task.priority}
                        </span>
                      </div>

                      {task.due_date && <p className="flex items-center gap-1.5 text-xs text-slate-600"><Calendar className="h-3.5 w-3.5" />{deadlineLabel(task.due_date, task.status, today)}</p>}
                      {task.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
                        <span className="flex items-center text-gray-600">
                          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-medium">{initials(task.assignee?.full_name || task.assignee?.email || '?')}</span>
                          {task.assignee?.full_name || task.assignee?.email || 'Unassigned'}
                        </span>
                        {task.task_comments?.length > 0 && (
                          <span className="flex items-center text-gray-400">
                            <MessageSquare className="w-3.5 h-3.5 mr-1" /> {task.task_comments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: PROJECT NOTES */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-surface rounded-xl border border-gray-200">
              <StickyNote className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No notes written for this project yet.</p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-surface border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-gray-900 text-base">{note.title}</h3>
                  {(isAdmin || note.author_id === currentUserId) && (
                    <button
                      disabled={isSubmitting} onClick={() => { if (confirm('Delete this note permanently?')) void runAction(() => deleteNote(note.id, project.id), 'Note deleted.'); }}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded-lg border border-gray-100">
                  {note.content}
                </div>

                <div className="text-xs text-gray-400 pt-2 border-t flex justify-between">
                  <span>By: {note.author?.full_name || note.author?.email}</span>
                  <span>{new Date(note.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

{/* TAB 3: TEAM & SETTINGS */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Admin Add Member Control */}
          {canManage && (
            <div className="bg-surface border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Add Teammate to This Project</h3>
              <p className="mb-4 text-sm text-slate-600">Add a workspace teammate here to make them available in the task assignee list. <Link href="/admin/users" className="font-medium text-blue-700 underline">Create a new member</Link></p>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  id="newProjectMemberSelect" aria-label="Teammate to add" value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select a team member to add...</option>
                  {allWorkspaceUsers
                    .filter((u: Member) => !members.some((m: Member) => m.id === u.id))
                    .map((u: Member) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.email})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newMemberId) return;
                    if (await runAction(() => addProjectMember(project.id, newMemberId), 'Teammate added. You can now assign tasks to them.')) setNewMemberId('');
                  }}
                  disabled={isSubmitting || !newMemberId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add to Project
                </button>
              </div>
            </div>
          )}

          {/* Assigned Members List */}
          <div className="bg-surface border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">
                Assigned Project Members ({members.length})
              </h3>
            </div>

            <div className="divide-y divide-gray-100">
              {members.map((m: Member) => (
                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <div className="text-sm font-medium text-gray-900 flex items-center">
                      {m.full_name || 'Anonymous User'}
                      {m.id === currentUserId && (
                        <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">You</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{m.email}</div>
                  </div>

                  {canManage && m.id !== project.created_by && m.id !== currentUserId && (
                    <button
                      onClick={() => { setFeedback(null); setMemberToRemove(m); }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium px-2.5 py-1 rounded hover:bg-red-50 transition border border-red-200"
                    >
                      Remove & Reassign Tasks
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingProject && <Modal title="Edit project" busy={isSubmitting} onClose={() => setEditingProject(false)}>{errorNotice}
        <form className="space-y-4" onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); if (await runAction(() => updateProject(project.id, form), 'Project updated.')) setEditingProject(false); }}>
          <label className="block text-sm">Project name<input name="name" defaultValue={project.name} required maxLength={200} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="block text-sm">Description<textarea name="description" defaultValue={project.description || ''} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="block text-sm">Visibility<select name="is_private" defaultValue={String(project.is_private)} className="mt-1 w-full rounded-lg border p-3"><option value="true">Private — selected members and admins</option><option value="false">Workspace — all members can view</option></select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_archived" value="true" defaultChecked={project.is_archived} />Archive project</label>
          <button disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Save project</button>
        </form>
      </Modal>}
      {isTaskModalOpen && (
        <Modal side title={editingTask ? 'Edit task' : 'Create new task'} busy={isSubmitting} onClose={() => setIsTaskModalOpen(false)}>
          {errorNotice}
          <TaskForm isAdmin={isAdmin} task={editingTask} members={members} busy={isSubmitting} onSubmit={handleSaveTask} onCancel={() => setIsTaskModalOpen(false)}
            onManageTeam={canManage ? () => { setIsTaskModalOpen(false); setActiveTab('members'); } : undefined} />
        </Modal>
      )}

      {deleteTarget && <DeleteConfirmation kind={deleteTarget.kind} name={deleteTarget.name} onClose={() => setDeleteTarget(null)}
        onConfirm={async (confirmation) => {
          const result = deleteTarget.kind === 'project' ? await deleteProject(deleteTarget.id, confirmation) : await deleteTask(deleteTarget.id, project.id);
          if (!result.error) {
            const isProject = deleteTarget.kind === 'project';
            setDeleteTarget(null); setSelectedTaskId(null);
            if (isProject) { router.push('/dashboard'); router.refresh(); }
            else setFeedback({ success: 'Task deleted.' });
          }
          return result;
        }} />}

      {/* MODAL: TASK DETAIL & COMMENTS */}
      {selectedTask && (
        <Modal side title={selectedTask.title} busy={isSubmitting} onClose={() => setSelectedTaskId(null)}>
          {errorNotice}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>Assigned to <strong>{selectedTask.assignee?.full_name || selectedTask.assignee?.email || 'Unassigned'}</strong> · <span className="capitalize">{selectedTask.priority} priority</span></span>
            {(isAdmin || selectedTask.created_by === currentUserId) && <button type="button" disabled={isSubmitting} onClick={() => { setEditingTask(selectedTask); setSelectedTaskId(null); setFeedback(null); setIsTaskModalOpen(true); }} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"><Pencil className="h-4 w-4" />Edit task</button>}
            {(isAdmin || selectedTask.created_by === currentUserId) && <button type="button" disabled={isSubmitting} onClick={() => { setDeleteTarget({ kind: 'task', id: selectedTask.id, name: selectedTask.title }); setSelectedTaskId(null); setFeedback(null); }} className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete task</button>}
          </div>
          {selectedTask.due_date && <p className="mb-3 text-sm text-slate-600">Due {new Date(selectedTask.due_date.slice(0, 10) + 'T00:00:00').toLocaleDateString()}</p>}
            {/* Quick Status Bar */}
            <div className="py-3 flex flex-wrap items-center gap-2 border-b border-slate-200 text-xs">
              <span className="font-semibold text-gray-700">Status:</span>
              {(['todo', 'in_progress', 'blocked', 'in_review', 'done'] as const).map((st) => (
                <button
                  key={st}
                  aria-pressed={selectedTask.status === st}
                  disabled={isSubmitting || (st === 'done' && !isAdmin) || (!isAdmin && selectedTask.created_by !== currentUserId && selectedTask.assignee_id !== currentUserId)}
                  onClick={async () => {
                    await runAction(() => updateTaskStatus(selectedTask.id, project.id, st), 'Status updated.');
                  }}
                  className={`px-2.5 py-1 rounded-full capitalize font-medium transition ${
                    selectedTask.status === st
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st === 'in_review' ? 'Ready for review' : st === 'done' ? 'Approve & complete' : st === 'in_progress' && selectedTask.status === 'in_review' && isAdmin ? 'Request changes' : st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {selectedTask.description && (
              <div className="py-3 text-sm text-gray-700 border-b">
                {selectedTask.description}
              </div>
            )}

            <TaskExtras key={selectedTask.id} task={selectedTask} tasks={tasks} members={members} canEdit={isAdmin || selectedTask.created_by === currentUserId || selectedTask.assignee_id === currentUserId} />
            {/* Comments Thread */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Comments & Updates</h4>
              {(!selectedTask.task_comments || selectedTask.task_comments.length === 0) ? (
                <p className="text-xs text-gray-400">No comments yet. Start the conversation below.</p>
              ) : (
                [...selectedTask.task_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center text-gray-500">
                      <span className="font-semibold text-gray-800">{c.author?.full_name || c.author?.email}</span>
                      <span>{new Date(c.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleAddComment} className="pt-3 border-t flex space-x-2">
              <input
                aria-label="Write a task update"
                maxLength={10000}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Write an update or comment..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isSubmitting || !commentInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center"
              >
                <Send className="w-4 h-4" /><span className="sr-only">Post update</span>
              </button>
            </form>
        </Modal>
      )}

      {/* MODAL: CREATE NOTE */}
      {isNoteModalOpen && (
        <Modal title="Add project note" busy={isSubmitting} onClose={() => setIsNoteModalOpen(false)}>
          {errorNotice}
            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Note Title *</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Architecture decisions"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Content *</label>
                <textarea
                  name="content"
                  rows={6}
                  required
                  placeholder="Write your notes here…"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Note
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* MODAL: REMOVE MEMBER & REASSIGN TASKS */}
      {memberToRemove && (
        <Modal title="Remove team member" busy={isSubmitting} onClose={() => setMemberToRemove(null)}>
          {errorNotice}
            <p className="text-sm text-gray-600 mb-4">
              You are removing <strong>{memberToRemove.full_name || memberToRemove.email}</strong> from this project.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reassign their existing tasks to:
                </label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Leave Tasks Unassigned</option>
                  {members
                    .filter((m: Member) => m.id !== memberToRemove.id)
                    .map((m: Member) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setMemberToRemove(null)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveMember}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Removal
                </button>
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
}
