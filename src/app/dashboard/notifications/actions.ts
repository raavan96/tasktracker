'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function setNotificationRead(id:string|null,isRead:boolean){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return {error:'Please sign in again.'};
 let query=db.from('notifications').update({is_read:isRead}).eq('user_id',user.id);
 if(id)query=query.eq('id',id);
 const {error}=await query;
 if(error)return {error:'Could not update notifications. Please try again.'};
 revalidatePath('/dashboard','layout');revalidatePath('/admin','layout');
 return {success:true};
}
