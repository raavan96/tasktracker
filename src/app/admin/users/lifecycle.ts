'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
async function admin(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Sign in again.');const {data}=await db.from('profiles').select('role').eq('id',user.id).single();if(data?.role!=='admin')throw new Error('Admin access required.');return db;}
export async function memberImpact(memberId:string){
 const db=await admin();const [tasks,projects,members,people,events]=await Promise.all([
 db.from('tasks').select('id,title,project_id,assignee_id,created_by,status,recurrence,review_version,is_archived'),
 db.from('projects').select('id,name,created_by,is_archived'),db.from('project_members').select('project_id,user_id'),db.from('profiles').select('id,full_name,email,is_active'),db.from('member_events').select('*').eq('member_id',memberId).order('created_at',{ascending:false}).limit(30)]);
 if([tasks,projects,members,people,events].some(r=>r.error))throw new Error('Could not load the member’s work. Please retry.');
 const activeProjects=(projects.data||[]).filter(p=>!p.is_archived);
 const active=(tasks.data||[]).filter(t=>!t.is_archived&&activeProjects.some(p=>p.id===t.project_id));
 return {tasks:active.filter(t=>t.assignee_id===memberId&&t.status!=='done'),projects:activeProjects,members:members.data||[],people:people.data||[],events:events.data||[],createdProjects:activeProjects.filter(p=>p.created_by===memberId).length,pendingReviews:active.filter(t=>t.created_by===memberId&&t.status==='in_review'&&t.assignee_id!==memberId).length,recurring:active.filter(t=>(t.assignee_id===memberId||t.created_by===memberId)&&t.recurrence!=='none').length};
}
export async function changeMemberState(id:string,active:boolean,reason:string){const db=await admin();const {error}=await db.rpc('set_member_active',{p_member:id,p_active:active,p_reason:reason});if(error)return {error:error.message};revalidatePath('/admin','layout');revalidatePath('/dashboard','layout');return {success:true};}
export async function reassignMemberWork(member:string,project:string,replacement:string|null,expected:{id:string;version:number}[]){const db=await admin();const {error}=await db.rpc('reassign_member_tasks',{p_member:member,p_project:project,p_replacement:replacement,p_expected:JSON.stringify(expected)});if(error)return {error:error.message};revalidatePath('/admin','layout');revalidatePath('/dashboard','layout');return {success:true};}
export async function changeReviewPolicy(enabled:boolean){const db=await admin();const {error}=await db.rpc('set_review_policy',{p_enabled:enabled});if(error)return {error:error.message};revalidatePath('/admin','layout');revalidatePath('/dashboard','layout');return {success:true};}
