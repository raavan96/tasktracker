'use client';

import { useState } from 'react';
import { 
  createTask, 
  updateTaskStatus, 
  deleteTask, 
  addComment, 
  deleteComment 
} from '@/app/dashboard/tasks/actions';
import { createNote, deleteNote } from '@/app/dashboard/notes/actions';
import { 
  addProjectMember, 
  removeProjectMember, 
  updateProject 
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
  User, 
  StickyNote, 
  Users, 
  Settings, 
  Send,
  Loader2,
  ChevronRight,
  Archive
} from 'lucide-react';

export default function ProjectView({
  project,
  tasks,
  notes,
  members,
  allWorkspaceUsers,
  currentUserId,
  isAdmin,
}: any) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes' | 'members'>('tasks');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const [reassignTo, setReassignTo] = useState<string>('');

  const statusColumns = [
    { id: 'todo', title: 'To Do', icon: Circle, color: 'text-gray-500 bg-gray-100' },
    { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { id: 'blocked', title: 'Blocked', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    { id: 'done', title: 'Done', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  ];

  // Handle task creation
  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    await createTask(project.id, formData);
    setIsSubmitting(false);
    setIsTaskModalOpen(false);
  }

  // Handle note creation
  async function handleCreateNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    await createNote(project.id, formData);
    setIsSubmitting(false);
    setIsNoteModalOpen(false);
  }

  // Handle sending comments
  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || !selectedTask) return;
    setIsSubmitting(true);
    await addComment(selectedTask.id, project.id, commentInput);
    setCommentInput('');
    setIsSubmitting(false);
  }

  // Handle member removal with task reassignment
  async function handleRemoveMember() {
    if (!memberToRemove) return;
    setIsSubmitting(true);
    await removeProjectMember(project.id, memberToRemove.id, reassignTo || undefined);
    setMemberToRemove(null);
    setReassignTo('');
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
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
          <div className="flex items-center space-x-2">
            {activeTab === 'tasks' && (isAdmin || members.some((m: any) => m.id === currentUserId)) && (
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Task
              </button>
            )}
            {activeTab === 'notes' && (
              <button
                onClick={() => setIsNoteModalOpen(true)}
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
      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statusColumns.map((col) => {
            const columnTasks = tasks.filter((t: any) => t.status === col.id);
            const Icon = col.icon;

            return (
              <div key={col.id} className="bg-gray-100/70 p-4 rounded-xl flex flex-col h-[75vh]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center space-x-2">
                    <span className={`p-1 rounded-md ${col.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-semibold text-sm text-gray-800">{col.title}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-semibold bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {columnTasks.map((task: any) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition cursor-pointer space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 leading-tight">{task.title}</h4>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          task.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {task.priority}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
                        <span className="flex items-center text-gray-600">
                          <User className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          {task.assignee?.full_name || 'Unassigned'}
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
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200">
              <StickyNote className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No notes written for this project yet.</p>
            </div>
          ) : (
            notes.map((note: any) => (
              <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-gray-900 text-base">{note.title}</h3>
                  {(isAdmin || note.author_id === currentUserId) && (
                    <button
                      onClick={() => deleteNote(note.id, project.id)}
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
          {isAdmin && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Add Teammate to This Project</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  id="newProjectMemberSelect"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  defaultValue=""
                >
                  <option value="" disabled>Select a team member to add...</option>
                  {allWorkspaceUsers
                    .filter((u: any) => !members.some((m: any) => m.id === u.id))
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.email})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    const select = document.getElementById('newProjectMemberSelect') as HTMLSelectElement;
                    if (!select.value) return;
                    setIsSubmitting(true);
                    await addProjectMember(project.id, select.value);
                    select.value = '';
                    setIsSubmitting(false);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add to Project
                </button>
              </div>
            </div>
          )}

          {/* Assigned Members List */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">
                Assigned Project Members ({members.length})
              </h3>
            </div>

            <div className="divide-y divide-gray-100">
              {members.map((m: any) => (
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

                  {isAdmin && m.id !== currentUserId && (
                    <button
                      onClick={() => setMemberToRemove(m)}
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

      {/* MODAL: CREATE TASK */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
                <input
                  name="title"
                  required
                  placeholder="Task title"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Details about this task..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Assignee</label>
                  <select
                    name="assigneeId"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    name="priority"
                    defaultValue="medium"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Due Date</label>
                <input
                  name="dueDate"
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TASK DETAIL & COMMENTS */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 border border-gray-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start pb-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedTask.title}</h3>
                <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                  <span>Assigned to: <strong>{selectedTask.assignee?.full_name || 'Unassigned'}</strong></span>
                  <span>•</span>
                  <span>Priority: <strong className="capitalize">{selectedTask.priority}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="py-3 flex items-center space-x-2 border-b text-xs">
              <span className="font-semibold text-gray-700">Status:</span>
              {(['todo', 'in_progress', 'blocked', 'done'] as const).map((st) => (
                <button
                  key={st}
                  onClick={async () => {
                    await updateTaskStatus(selectedTask.id, project.id, st);
                    setSelectedTask({ ...selectedTask, status: st });
                  }}
                  className={`px-2.5 py-1 rounded-full capitalize font-medium transition ${
                    selectedTask.status === st
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {selectedTask.description && (
              <div className="py-3 text-sm text-gray-700 border-b">
                {selectedTask.description}
              </div>
            )}

            {/* Comments Thread */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Comments & Updates</h4>
              {(!selectedTask.task_comments || selectedTask.task_comments.length === 0) ? (
                <p className="text-xs text-gray-400">No comments yet. Start the conversation below.</p>
              ) : (
                selectedTask.task_comments.map((c: any) => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center text-gray-500">
                      <span className="font-semibold text-gray-800">{c.author?.full_name || c.author?.email}</span>
                      <span>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-gray-700 text-sm">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleAddComment} className="pt-3 border-t flex space-x-2">
              <input
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
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NOTE */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Project Note (Markdown)</h2>
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Content (Markdown supported) *</label>
                <textarea
                  name="content"
                  rows={6}
                  required
                  placeholder="Write your notes here..."
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
          </div>
        </div>
      )}

      {/* MODAL: REMOVE MEMBER & REASSIGN TASKS */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-red-600 mb-2">Remove Team Member</h2>
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
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Leave Tasks Unassigned</option>
                  {members
                    .filter((m: any) => m.id !== memberToRemove.id)
                    .map((m: any) => (
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
          </div>
        </div>
      )}
    </div>
  );
}