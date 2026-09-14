'use server';
import {workspaceRead} from '@/lib/workspace-data';
import {revalidatePath} from 'next/cache';
export type Remark={id:string;task_id:string;author_id:string;content:string;mentions:string[];created_at:string;edited_at:string|null;edit_version:number;author:string};
export async function listRemarks(task:string,before?:{created_at:string;id:string}){return workspaceRead(async db=>{
 const rows=(await db.query<Remark>("SELECT c.*,coalesce(p.full_name,p.email) author FROM task_comments c JOIN profiles p ON p.id=c.author_id WHERE c.task_id=$1 AND ($2::timestamptz IS NULL OR (c.created_at,c.id)<($2::timestamptz,$3::uuid)) ORDER BY c.created_at DESC,c.id DESC LIMIT 26",[task,before?.created_at||null,before?.id||null])).rows;
 return {items:rows.slice(0,25),more:rows.length>25};
});}
export async function saveRemark(task:string,content:string,mentions:string[],id?:string,version?:number){try{return await workspaceRead(async(db,user)=>{
 if(!content.trim()||content.length>10000||!Array.isArray(mentions)||mentions.length>30)throw new Error('Enter a remark up to 10,000 characters.');
 const target=(await db.query<{project_id:string}>('SELECT project_id FROM tasks WHERE id=$1 AND NOT is_archived AND public.can_work_project(project_id)',[task])).rows[0];if(!target)throw new Error('Task unavailable or archived.');
 if(id){if(!Number.isSafeInteger(Number(version)))throw new Error('Reload the remark before editing.');const result=await db.query('UPDATE task_comments SET content=$1,mentions=$2 WHERE id=$3 AND task_id=$4 AND author_id=$5 AND edit_version=$6 RETURNING id',[content.trim(),[...new Set(mentions)],id,task,user,version]);if(!result.rowCount)throw new Error('This remark changed. Your draft is kept; reload before editing again.');}
 else await db.query('INSERT INTO task_comments(task_id,author_id,content,mentions) VALUES($1,$2,$3,$4)',[task,user,content.trim(),[...new Set(mentions)]]);
 revalidatePath('/dashboard/projects/'+target.project_id);return {error:''};
 });}catch(e){return {error:e instanceof Error?e.message:'Remark could not be saved.'};}}
export async function remarkHistory(comment:string){return workspaceRead(async db=>(await db.query<{id:string;content:string;created_at:string}>('SELECT id,content,created_at FROM remark_edits WHERE comment_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[comment])).rows);}
