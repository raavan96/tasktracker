'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function reviewTask(taskId:string,projectId:string,version:number,decision:string,reason=''){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Please sign in again.'};
 if(!Number.isSafeInteger(Number(version))||!['submit','approve','changes','withdraw','reopen'].includes(decision))return {error:'Invalid review request.'};
 const {error}=await db.rpc('review_task',{p_task:taskId,p_version:version,p_decision:decision,p_reason:reason});
 if(error)return {error:error.message};
 revalidatePath(`/dashboard/projects/${projectId}`);revalidatePath('/dashboard','layout');return {success:true};
}
