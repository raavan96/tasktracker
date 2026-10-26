import NotificationSettingsPanel from '@/components/NotificationSettingsPanel';
import EmailPreferences from '@/components/EmailPreferences';
import {workspaceRead} from '@/lib/workspace-data';
import {notificationContextSQL} from '@/lib/notification-context';
import NotificationPreferences,{type NotificationSettings} from '@/components/NotificationPreferences';
import NotificationsClient,{type Notification, type NotificationCategory, type CategoryCounts} from './NotificationsClient';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const rawFilter = params.filter;
  const category = (['action', 'mentions', 'updates'].includes(params.category || '')
    ? params.category
    : 'all') as NotificationCategory;

  const result = await workspaceRead(async (db, user) => {
    const counts=(await db.query<{category:string;total:string;unread:string}>(notificationContextSQL+` SELECT category,count(*) total,count(*) FILTER(WHERE NOT is_read) unread FROM classified GROUP BY category`,[user])).rows;
    const unreadAll=counts.reduce((sum,row)=>sum+Number(row.unread),0);
    const filter=rawFilter==='all'?'all':rawFilter==='unread'?'unread':unreadAll>0?'unread':'all';
    const categoryCounts:CategoryCounts={all:0,action:0,mentions:0,updates:0};
    for(const row of counts){const value=Number(filter==='unread'?row.unread:row.total);categoryCounts[row.category as Exclude<NotificationCategory,'all'>]=value;categoryCounts.all+=value;}
    const total=categoryCounts[category],pages=Math.max(1,Math.ceil(total/10));
    const page=Math.min(pages,Math.max(1,Math.trunc(Number(params.page)||1)));
    const notifications=(await db.query<Notification>(notificationContextSQL+` SELECT id,title,message,chat_id,dedupe_key,created_at,is_read,task,actor_name,event_review_id,assignment_id,action_needed,current_event,category FROM classified WHERE ($2<>'unread' OR NOT is_read) AND ($3='all' OR category=$3) ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET $4`,[user,filter,category,(page-1)*10])).rows;

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
      filter,
    };
  });

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-10">
      <NotificationsClient {...result} />
      <NotificationSettingsPanel>
        <NotificationPreferences initial={result.preferences} />
        <EmailPreferences deliveryEnabled={result.deliveryEnabled} />
      </NotificationSettingsPanel>
    </div>
  );
}
