'use client';
import WorkspaceHeading from '@/components/WorkspaceHeading';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {setNotificationRead} from './actions';
import {
  type Notification,
  type NotificationTask,
  type NotificationCategory,
  type CategoryCounts,
  type ResolutionContext,
  getNotificationResolution,
} from '@/lib/notification-resolution';

export type {
  Notification,
  NotificationTask,
  NotificationCategory,
  CategoryCounts,
  ResolutionContext,
};
export { getNotificationResolution };

function getBadgeClasses(variant: ResolutionContext['variant']) {
  switch (variant) {
    case 'action':
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'success':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'warn':
      return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    case 'info':
      return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'muted':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export default function NotificationsClient({
  notifications,
  filter,
  unread,
  categoryCounts,
  category = 'all',
  page,
  pages,
  total,
}: {
  notifications: Notification[];
  filter: string;
  unread: number;
  categoryCounts: CategoryCounts;
  category?: NotificationCategory;
  page: number;
  pages: number;
  total: number;
}) {
  const router = useRouter();
  const href = (next: number, scope = filter, cat = category) =>
    `/dashboard/notifications?filter=${scope}&category=${cat}&page=${next}`;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function update(id: string | null, read: boolean) {
    setBusy(true);
    setError('');
    try {
      const result = await setNotificationRead(id, read);
      if (result.error) setError(result.error);
    } catch {
      setError('Could not confirm the change. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const visible = notifications.filter(n => filter !== 'unread' || !n.is_read);

  const categories: { key: NotificationCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'action', label: 'Action needed' },
    { key: 'mentions', label: 'Mentions' },
    { key: 'updates', label: 'Updates' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div>
        <WorkspaceHeading className="text-2xl font-bold">Notifications</WorkspaceHeading>
        <p className="text-sm text-gray-500">
          Assignments, deadline reminders, remarks, and review resolution updates.
        </p>
      </div>

      {/* Category Tabs & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Category Tabs */}
        <nav aria-label="Notification categories" className="flex flex-wrap items-center gap-1.5">
          {categories.map(cat => {
            const count = categoryCounts[cat.key];
            const isActive = category === cat.key;
            return (
              <Link
                key={cat.key}
                href={href(1, filter, cat.key)}
                className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border bg-surface text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Read State Filter & Mark All Read */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Notification filter"
            className="rounded-lg border bg-surface p-2.5 text-sm"
            value={filter}
            onChange={e => router.push(href(1, e.target.value, category))}
          >
            <option value="all">All notifications</option>
            <option value="unread">Unread ({unread})</option>
          </select>
          <button
            disabled={busy || !unread}
            className="rounded-lg border bg-surface px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800"
            onClick={() => update(null, true)}
          >
            Mark all as read
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}

      {/* Notifications List */}
      <div aria-busy={busy} className="rounded-xl border bg-surface divide-y">
        {visible.map(n => {
          const resolution = getNotificationResolution(n);
          return (
            <article
              key={n.id}
              className={`p-4 space-y-3 transition-colors ${n.is_read ? '' : 'bg-blue-50/40 dark:bg-blue-950/20'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">{n.title}</h2>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeClasses(
                        resolution.variant
                      )}`}
                    >
                      {resolution.badge}
                    </span>
                    {!n.is_read && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                        Unread
                      </span>
                    )}
                  </div>

                  {/* Project and Actor Attribution Context */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    {n.task?.project_name && (
                      <span>
                        Project: <strong className="font-medium text-gray-800 dark:text-gray-200">{n.task.project_name}</strong>
                      </span>
                    )}
                    {n.task?.project_name && n.actor_name && <span aria-hidden="true">·</span>}
                    {n.actor_name && (
                      <span>
                        By <strong className="font-medium text-gray-800 dark:text-gray-200">{n.actor_name}</strong>
                      </span>
                    )}
                    {(n.task?.project_name || n.actor_name) && <span aria-hidden="true">·</span>}
                    <time dateTime={n.created_at}>
                      {new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </time>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <p className="text-sm text-gray-700 dark:text-gray-300">{n.message}</p>

              {/* Resolution Explanation if Stale Action */}
              {resolution.explanation && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {resolution.explanation}
                </div>
              )}

              {/* Action Buttons Row with strictly aligned flex geometry */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {n.chat_id && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('tasktracker:open-chat', { detail: { id: n.chat_id } })
                      )
                    }
                    className="inline-flex min-h-11 items-center text-blue-600 dark:text-blue-400 underline"
                  >
                    Open chat
                  </button>
                )}
                {n.task?.project_id && (
                  <Link
                    className="inline-flex min-h-11 items-center text-blue-600 dark:text-blue-400 underline"
                    href={`/dashboard/projects/${n.task.project_id}?task=${n.task.id}${
                      n.dedupe_key?.match(/^mention:([0-9a-f-]{36}):/i)
                        ? '&discussion=true#remark-' + n.dedupe_key.split(':')[1]
                        : ''
                    }`}
                  >
                    Open task
                  </Link>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => update(n.id, !n.is_read)}
                  className="inline-flex min-h-11 items-center text-blue-600 dark:text-blue-400 underline disabled:opacity-50"
                >
                  {n.is_read ? 'Mark as unread' : 'Mark as read'}
                </button>
              </div>
            </article>
          );
        })}

        {!visible.length && (
          <p className="p-10 text-center text-gray-500">
            {filter === 'unread' ? 'You’re all caught up.' : 'No notifications yet.'}
          </p>
        )}
      </div>

      {/* Pagination */}
      <nav aria-label="Notification pages" className="flex items-center gap-4 text-sm">
        {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
        <span>
          {total} notifications · Page {page} of {pages}
        </span>
        {page < pages && <Link href={href(page + 1)}>Next</Link>}
      </nav>
    </div>
  );
}
