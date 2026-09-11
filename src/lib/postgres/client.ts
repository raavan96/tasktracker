import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertAdmin, currentUser, localAuth } from './auth';
import { transaction } from './db';
import { Query, type Run } from './query';
import { localStorage } from './storage';
// Keep the existing server callers stable during staging. The compatibility
// boundary is internal; unsupported operations have no fallback to Supabase.
export function createLocalClient(privileged=false):SupabaseClient {
  const run:Run=async work=>{const user=privileged?await assertAdmin():await currentUser();if(!user)throw new Error('Please sign in again.');return transaction(user.id,work,privileged);};
  const local={auth:localAuth(),from:(table:string)=>new Query(table,run),storage:localStorage(run),
    rpc:async(name:string,args:Record<string,unknown>)=>{
      try {
        const functions:Record<string,string[]>={create_workspace_project:['p_name','p_description','p_members','p_private'],remove_member_and_reassign_tasks:['p_project_id','p_member_id','p_new_assignee_id']};
        const fields=functions[name];if(!fields)throw new Error('Unsupported database function.');
        const data=await run(async db=>(await db.query(`SELECT public.${name}(${fields.map((_,n)=>`$${n+1}`).join(',')}) value`,fields.map(f=>args[f]??null))).rows[0].value);
        return {data,error:null};
      }catch(error){return {data:null,error:{message:error instanceof Error?error.message:'Database operation failed.'}};}
    }};
  return local as unknown as SupabaseClient;
}
