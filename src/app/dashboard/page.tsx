import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { FolderKanban, Users, CheckCircle2 } from 'lucide-react';
import TaskSummary from '@/components/TaskSummary';
import { todayKey } from '@/lib/task-presentation';
import CreateProjectModal from './CreateProjectModal';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  const [{ data: projects }, { data: allUsers }] = await Promise.all([
    supabase.from('projects').select(`
      id, name, description, is_archived, created_at,
      project_members(count), tasks(id, status, due_date)
    `).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Manage workspace projects and team assignments' : 'Projects you are currently working on'}
          </p>
        </div>

        <CreateProjectModal users={allUsers || []} />
      </div>

      <TaskSummary tasks={(projects || []).filter(p => !p.is_archived).flatMap(p => p.tasks || [])} today={todayKey()} />
      {/* Projects Grid */}
      {(!projects || projects.length === 0) ? (
        <div className="text-center py-16 bg-surface border border-gray-200 rounded-xl">
          <FolderKanban className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No projects found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            {isAdmin 
              ? 'Get started by creating your first team project above.'
              : 'You have not been assigned to any active projects yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const memberCount = project.project_members?.[0]?.count || 0;
            const totalTasks = project.tasks?.length || 0;
            const completedTasks = project.tasks?.filter((t) => t.status === 'done').length || 0;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className={`block bg-surface rounded-xl border p-6 hover:shadow-md transition ${
                  project.is_archived ? 'opacity-60 border-dashed border-gray-300' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h2>
                  {project.is_archived && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                      Archived
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-500 mt-2 line-clamp-2 h-10">
                  {project.description || 'No description provided.'}
                </p>

                {/* Progress bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1 text-gray-400" /> {memberCount} members
                  </span>
                  <span className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-gray-400" /> {completedTasks}/{totalTasks} tasks
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}