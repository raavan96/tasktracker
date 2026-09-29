import NotificationSettingsPanel from '@/components/NotificationSettingsPanel';
import EmailPreferences from '@/components/EmailPreferences';
import {workspaceRead} from '@/lib/workspace-data';
import NotificationPreferences,{type NotificationSettings} from '@/components/NotificationPreferences';
import NotificationsClient,{type Notification, type NotificationCategory, type CategoryCounts} from './NotificationsClient';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter === 'unread' ? 'unread' : 'all';
  const category = (['action', 'mentions', 'updates'].includes(params.category || '')
    ? params.category
    : 'all') as NotificationCategory;

  const result = await workspaceRead(async (db, user) => {
    const countRow = (await db.query<{
      total: string;
      unread: string;
      action: string;
      action_unread: string;
      mentions: string;
      mentions_unread: string;
    }>(`
      SELECT
        count(*) total,
        count(*) FILTER (WHERE NOT n.is_read) unread,
        count(*) FILTER (
          WHERE (n.title = 'Ready for review' AND t.status = 'in_review' AND NOT coalesce(t.is_archived, false))
             OR (n.title IN ('Task assigned', 'Due today', 'Task overdue', 'Due tomorrow') AND t.status NOT IN ('done') AND NOT coalesce(t.is_archived, false))
             OR (n.title = 'Changes requested' AND t.status = 'in_progress' AND NOT coalesce(t.is_archived, false))
        ) action,
        count(*) FILTER (
          WHERE ((n.title = 'Ready for review' AND t.status = 'in_review' AND NOT coalesce(t.is_archived, false))
             OR (n.title IN ('Task assigned', 'Due today', 'Task overdue', 'Due tomorrow') AND t.status NOT IN ('done') AND NOT coalesce(t.is_archived, false))
             OR (n.title = 'Changes requested' AND t.status = 'in_progress' AND NOT coalesce(t.is_archived, false)))
            AND NOT n.is_read
        ) action_unread,
        count(*) FILTER (
          WHERE n.title = 'Chat mention' OR n.title = 'You were mentioned' OR n.dedupe_key LIKE 'mention:%'
        ) mentions,
        count(*) FILTER (
          WHERE (n.title = 'Chat mention' OR n.title = 'You were mentioned' OR n.dedupe_key LIKE 'mention:%')
            AND NOT n.is_read
        ) mentions_unread
      FROM notifications n
      LEFT JOIN tasks t ON t.id = n.task_id
      WHERE n.user_id = $1
    `, [user])).rows[0];

    const totalAll = Number(countRow?.total || 0);
    const unreadAll = Number(countRow?.unread || 0);
    const actionTotal = Number(countRow?.action || 0);
    const actionUnread = Number(countRow?.action_unread || 0);
    const mentionsTotal = Number(countRow?.mentions || 0);
    const mentionsUnread = Number(countRow?.mentions_unread || 0);
    const updatesTotal = Math.max(0, totalAll - actionTotal - mentionsTotal);
    const updatesUnread = Math.max(0, unreadAll - actionUnread - mentionsUnread);

    const categoryCounts: CategoryCounts = {
      all: filter === 'unread' ? unreadAll : totalAll,
      action: filter === 'unread' ? actionUnread : actionTotal,
      mentions: filter === 'unread' ? mentionsUnread : mentionsTotal,
      updates: filter === 'unread' ? updatesUnread : updatesTotal,
    };

    const total = categoryCounts[category];
    const pages = Math.max(1, Math.ceil(total / 50));
    const page = Math.min(pages, Math.max(1, Math.trunc(Number(params.page) || 1)));

    let categoryFilterSql = '';
    if (category === 'action') {
      categoryFilterSql = `AND (
        (n.title = 'Ready for review' AND t.status = 'in_review' AND NOT coalesce(t.is_archived, false))
        OR (n.title IN ('Task assigned', 'Due today', 'Task overdue', 'Due tomorrow') AND t.status NOT IN ('done') AND NOT coalesce(t.is_archived, false))
        OR (n.title = 'Changes requested' AND t.status = 'in_progress' AND NOT coalesce(t.is_archived, false))
      )`;
    } else if (category === 'mentions') {
      categoryFilterSql = `AND (
        n.title = 'Chat mention' OR n.title = 'You were mentioned' OR n.dedupe_key LIKE 'mention:%'
      )`;
    } else if (category === 'updates') {
      categoryFilterSql = `AND NOT (
        (n.title = 'Ready for review' AND t.status = 'in_review' AND NOT coalesce(t.is_archived, false))
        OR (n.title IN ('Task assigned', 'Due today', 'Task overdue', 'Due tomorrow') AND t.status NOT IN ('done') AND NOT coalesce(t.is_archived, false))
        OR (n.title = 'Changes requested' AND t.status = 'in_progress' AND NOT coalesce(t.is_archived, false))
      ) AND NOT (
        n.title = 'Chat mention' OR n.title = 'You were mentioned' OR n.dedupe_key LIKE 'mention:%'
      )`;
    }

    const notifications = (await db.query<Notification>(`
      SELECT
        n.id,
        n.title,
        n.message,
        n.chat_id,
        n.dedupe_key,
        n.created_at,
        n.is_read,
        CASE WHEN t.id IS NULL THEN NULL
             ELSE jsonb_build_object(
               'id', t.id,
               'project_id', t.project_id,
               'title', t.title,
               'status', t.status,
               'is_archived', coalesce(t.is_archived, false),
               'project_name', pr.name
             )
        END task,
        coalesce(
          CASE WHEN n.title IN ('Ready for review','Task approved','Changes requested','Review invalidated','Task review updated') THEN latest_review.actor_name END,
          CASE WHEN n.dedupe_key LIKE 'mention:%' THEN comment_author.actor_name END,
          CASE WHEN n.title = 'Task assigned' THEN creator.full_name END
        ) AS actor_name
      FROM notifications n
      LEFT JOIN tasks t ON t.id = n.task_id
      LEFT JOIN projects pr ON pr.id = t.project_id
      LEFT JOIN profiles creator ON creator.id = t.created_by
      LEFT JOIN LATERAL (
        SELECT p_act.full_name AS actor_name
        FROM task_reviews tr
        JOIN profiles p_act ON p_act.id = tr.actor_id
        WHERE tr.task_id = t.id
        ORDER BY tr.created_at DESC
        LIMIT 1
      ) latest_review ON true
      LEFT JOIN LATERAL (
        SELECT p_comm.full_name AS actor_name
        FROM task_comments tc
        JOIN profiles p_comm ON p_comm.id = tc.author_id
        WHERE tc.id::text = split_part(n.dedupe_key, ':', 2)
        LIMIT 1
      ) comment_author ON true
      WHERE n.user_id = $1
        AND ($2 <> 'unread' OR NOT n.is_read)
        ${categoryFilterSql}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 50 OFFSET $3
    `, [user, filter, (page - 1) * 50])).rows;

    const preferences = (await db.query<NotificationSettings>(
      'SELECT deadline_days,mentions,assignments,reviews FROM notification_preferences WHERE user_id=$1',
      [user]
    )).rows[0] || { deadline_days: 1, mentions: true, assignments: true, reviews: true };

    const deliveryEnabled = (await db.query('SELECT enabled FROM email_delivery_settings WHERE id')).rows[0]?.enabled === true;

    return {
      deliveryEnabled,
      preferences,
      notifications,
      unread: unreadAll,
      categoryCounts,
      category,
      page,
      pages,
      total,
    };
  });

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-10">
      <NotificationsClient {...result} filter={filter} />
      <NotificationSettingsPanel>
        <NotificationPreferences initial={result.preferences} />
        <EmailPreferences deliveryEnabled={result.deliveryEnabled} />
      </NotificationSettingsPanel>
    </div>
  );
}
