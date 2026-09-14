import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertAdmin, currentUser, localAuth } from './auth';
import { transaction } from './db';
import { Query, type Run } from './query';
import { localStorage } from './storage';
// Keep the existing server callers stable during staging. The compatibility
// boundary is internal; unsupported operations have no fallback to Supabase.
export function createLocalClient(privileged=false):SupabaseClient {
  const run:Run=async work=>{const user=privileged?await assertAdmin():await currentUser();if(!user)throw new Error('Please sign in again.');return transaction(user.id,async db=>{if(privileged){await db.query('SELECT pg_advisory_xact_lock(90261007)');await db.query('SELECT public.assert_active()');if(!(await db.query('SELECT public.is_admin() allowed')).rows[0].allowed)throw new Error('Admin privileges required.');}return work(db);},privileged);};
  const local={auth:localAuth(),from:(table:string)=>new Query(table,run),storage:localStorage(run),
    rpc:async(name:string,args:Record<string,unknown>)=>{
      try {
        const functions:Record<string,string[]>={review_task:['p_task','p_version','p_decision','p_reason'],set_member_active:['p_member','p_active','p_reason'],set_review_policy:['p_enabled'],reassign_member_tasks:['p_member','p_project','p_replacement','p_expected'],set_archive:['p_kind','p_id','p_archived','p_confirm_unfinished','p_complete'],bulk_archive_tasks:['p_project_id','p_days'],create_workspace_project:['p_name','p_description','p_members','p_private'],remove_member_and_reassign_tasks:['p_project_id','p_member_id','p_new_assignee_id']};
        const fields=functions[name];if(!fields)throw new Error('Unsupported database function.');
        const data=await run(async db=>(await db.query(`SELECT public.${name}(${fields.map((_,n)=>`$${n+1}`).join(',')}) value`,fields.map(f=>args[f]??null))).rows[0].value);
        return {data,error:null};
      }catch(error){return {data:null,error:{message:error instanceof Error?error.message:'Database operation failed.'}};}
    }};
  return local as unknown as SupabaseClient;
}
