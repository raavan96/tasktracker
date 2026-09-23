import NotificationSettingsPanel from '@/components/NotificationSettingsPanel';
import EmailPreferences from '@/components/EmailPreferences';
import {workspaceRead} from '@/lib/workspace-data';
import NotificationPreferences,{type NotificationSettings} from '@/components/NotificationPreferences';
import NotificationsClient,{type Notification} from './NotificationsClient';
export default async function NotificationsPage({searchParams}:{searchParams:Promise<{filter?:string;page?:string}>}){
 const params=await searchParams,filter=params.filter==='unread'?'unread':'all';
 const result=await workspaceRead(async(db,user)=>{
  const counts=(await db.query<{total:string;unread:string}>('SELECT count(*) total,count(*) FILTER (WHERE NOT is_read) unread FROM notifications WHERE user_id=$1',[user])).rows[0];
  const total=Number(filter==='unread'?counts.unread:counts.total),pages=Math.max(1,Math.ceil(total/50));
  const page=Math.min(pages,Math.max(1,Math.trunc(Number(params.page)||1)));
  const notifications=(await db.query<Notification>("SELECT n.id,n.title,n.message,n.chat_id,n.dedupe_key,n.created_at,n.is_read,CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'project_id',t.project_id) END task FROM notifications n LEFT JOIN tasks t ON t.id=n.task_id WHERE n.user_id=$1 AND ($2<>'unread' OR NOT n.is_read) ORDER BY n.created_at DESC,n.id DESC LIMIT 50 OFFSET $3",[user,filter,(page-1)*50])).rows;
  const preferences=(await db.query<NotificationSettings>('SELECT deadline_days,mentions,assignments,reviews FROM notification_preferences WHERE user_id=$1',[user])).rows[0]||{deadline_days:1,mentions:true,assignments:true,reviews:true};
  const deliveryEnabled=(await db.query('SELECT enabled FROM email_delivery_settings WHERE id')).rows[0]?.enabled===true;
  return {deliveryEnabled,preferences,notifications,unread:Number(counts.unread),page,pages,total};
 });
 return <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-10"><NotificationsClient {...result} filter={filter}/><NotificationSettingsPanel><NotificationPreferences initial={result.preferences}/><EmailPreferences deliveryEnabled={result.deliveryEnabled}/></NotificationSettingsPanel></div>;
}
