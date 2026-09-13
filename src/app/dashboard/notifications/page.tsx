import {createClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import NotificationsClient from './NotificationsClient';
export default async function NotificationsPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data,error}=await db.from('notifications').select('*,task:tasks(id,project_id,title)').eq('user_id',user.id).order('created_at',{ascending:false});
 if(error)throw new Error('Notifications could not load. Please try again.');
 return <NotificationsClient notifications={data||[]}/>;
}
