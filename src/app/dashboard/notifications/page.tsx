import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { Bell, CheckCheck, Clock, ExternalLink } from 'lucide-react';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: notifications } = await supabase
    .from('notifications')
    .select(`
      *,
      task:tasks(id, project_id, title)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  async function markAllAsRead() {
    'use server';
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id);
      revalidatePath('/dashboard/notifications');
      revalidatePath('/dashboard');
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">Task assignment alerts and workspace updates.</p>
        </div>

        {notifications && notifications.some((n: any) => !n.is_read) && (
          <form action={markAllAsRead}>
            <button
              type="submit"
              className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg flex items-center font-medium shadow-sm transition"
            >
              <CheckCheck className="w-4 h-4 mr-1.5 text-blue-600" /> Mark all as read
            </button>
          </form>
        )}
      </div>

      {(!notifications || notifications.length === 0) ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No notifications yet</h3>
          <p className="text-sm text-gray-500 mt-1">When tasks are assigned to you, you will see alerts here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 transition ${
                n.is_read ? 'bg-white' : 'bg-blue-50/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-semibold text-gray-900">{n.title}</h4>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>
                <p className="text-sm text-gray-600">{n.message}</p>
                <div className="text-xs text-gray-400 flex items-center pt-1">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>

              {n.task?.project_id && (
                <Link
                  href={`/dashboard/projects/${n.task.project_id}`}
                  className="text-xs text-blue-600 hover:underline flex items-center font-medium self-center"
                >
                  View Project <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}