'use server';
import {workspaceRead} from '@/lib/workspace-data';
import {writeRemark,type Remark} from '@/lib/postgres/remarks';
export type {Remark} from '@/lib/postgres/remarks';
export async function listRemarks(task:string,before?:{created_at:string;id:string}){return workspaceRead(async db=>{
 const rows=(await db.query<Remark>("SELECT c.*,coalesce(p.full_name,p.email) author FROM task_comments c JOIN profiles p ON p.id=c.author_id WHERE c.task_id=$1 AND ($2::timestamptz IS NULL OR (c.created_at,c.id)<($2::timestamptz,$3::uuid)) ORDER BY c.created_at DESC,c.id DESC LIMIT 26",[task,before?.created_at||null,before?.id||null])).rows;
 return {items:rows.slice(0,25),more:rows.length>25};
});}
export async function saveRemark(task:string,content:string,mentions:string[],id?:string,version?:number,requestId?:string){
 const started=performance.now();
 try{const item=await workspaceRead((db,user)=>writeRemark(db,user,task,content,mentions,id,version,requestId));
 return {error:'',item};
 }catch(e){return {error:e instanceof Error?e.message:'Remark could not be saved.',item:null};}
 finally{console.info(JSON.stringify({event:'remark_save',durationMs:Math.round(performance.now()-started)}));}
}
export async function remarkHistory(comment:string){return workspaceRead(async db=>(await db.query<{id:string;content:string;created_at:string}>('SELECT id,content,created_at FROM remark_edits WHERE comment_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[comment])).rows);}
