'use client';

import { useState } from 'react';
import type { TaskStatus, Task } from '@/lib/task-types';
import Link from 'next/link';
import { updateTaskStatus } from '@/app/dashboard/tasks/actions';
import { 
  Search, 
  CheckCircle2, 
  Calendar, 
  ExternalLink,
  MessageSquare
} from 'lucide-react';

export default function MyTasksClient({
  initialTasks,
  projects, isAdmin = false,
}: {
  initialTasks: (Omit<Task, 'task_comments' | 'assignee' | 'created_by'> & { project?: { name: string }; task_comments?: { count: number }[] })[];
  projects: { id: string; name: string }[]; isAdmin?: boolean;
}) {
  const tasks = initialTasks;
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Filter logic
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesProject = projectFilter === 'all' || t.project_id === projectFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesProject && matchesPriority;
  });

  async function handleQuickStatusChange(taskId: string, projectId: string, newStatus: TaskStatus) {
    setPendingId(taskId); setError('');
    try {
      const result = await updateTaskStatus(taskId, projectId, newStatus);
      if (result.error) setError(result.error);
    } catch { setError('The status could not be saved. Please try again.'); }
    finally { setPendingId(null); }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {/* Search & Filter Bar */}
      <div className="bg-surface p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            aria-label="Search tasks" placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Project Filter */}
        <div>
          <select
            aria-label="Filter by project" value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            aria-label="Filter by status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="in_review">Ready for review</option><option value="done">Completed</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <select
            aria-label="Filter by priority" value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-gray-200 rounded-xl">
          <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No tasks found</h3>
          <p className="text-sm text-gray-500 mt-1">Try clearing your filters or check back when new tasks are assigned to you.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {filteredTasks.map((task) => (
            <div key={task.id} className="p-4 hover:bg-gray-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                    task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    task.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {task.priority}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">{task.title}</h3>
                </div>

                {task.description && (
                  <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
                )}

                <div className="flex items-center space-x-4 text-xs text-gray-400">
                  <Link 
                    href={`/dashboard/projects/${task.project_id}`}
                    className="text-blue-600 hover:underline flex items-center font-medium"
                  >
                    {task.project?.name} <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                  {task.due_date && (
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Due {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {(task.task_comments?.[0]?.count || 0) > 0 && (
                    <span className="flex items-center">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {task.task_comments?.[0]?.count}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Status Select */}
              <div className="flex items-center space-x-2 self-start sm:self-center">
                <select
                  aria-label={`Status for ${task.title}`}
                  disabled={pendingId !== null}
                  value={task.status}
                  onChange={(e) => handleQuickStatusChange(task.id, task.project_id, e.target.value as TaskStatus)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                    task.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' :
                    task.status === 'blocked' ? 'bg-red-50 text-red-700 border-red-200' :
                    task.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="in_review">Ready for review</option><option value="done" disabled={!isAdmin}>Completed (admin approval)</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
