import type {PoolClient} from 'pg';
export type Remark={id:string;task_id:string;author_id:string;content:string;mentions:string[];created_at:string;edited_at:string|null;edit_version:number;author:string};
const projection='c.id,c.task_id,c.author_id,c.content,c.mentions,c.created_at,c.edited_at,c.edit_version,coalesce(p.full_name,p.email) author';
export async function writeRemark(db:Pick<PoolClient,'query'>,user:string,task:string,content:string,mentions:string[],id?:string,version?:number,requestId?:string){
 if(typeof content!=='string'||!content.trim()||content.length>10000||!Array.isArray(mentions)||mentions.length>30||mentions.some(x=>typeof x!=='string'))throw new Error('Enter a remark up to 10,000 characters.');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(requestId&&!uuid.test(requestId))throw new Error('Invalid save request. Reload before retrying.');
 const target=(await db.query('SELECT project_id FROM tasks WHERE id=$1 AND NOT is_archived AND public.can_work_project(project_id)',[task])).rows[0];
 if(!target)throw new Error('Task unavailable or archived.');
 const text=content.trim(),people=[...new Set(mentions)].sort();
 let savedId=id;
 if(id){
  if(version===undefined||!Number.isSafeInteger(version)||version<0)throw new Error('Reload the remark before editing.');
  const result=await db.query('UPDATE task_comments SET content=$1,mentions=$2 WHERE id=$3 AND task_id=$4 AND author_id=$5 AND edit_version=$6 RETURNING id',[text,people,id,task,user,version]);
  if(!result.rowCount){
   const current=(await db.query<Remark>('SELECT * FROM task_comments WHERE id=$1 AND task_id=$2 AND author_id=$3',[id,task,user])).rows[0];
   // A lost response can be retried without overwriting a subsequent edit.
   if(!current||Number(current.edit_version)!==version+1||current.content!==text||JSON.stringify([...current.mentions].sort())!==JSON.stringify(people))throw new Error('This remark changed. Your draft is kept; reload before editing again.');
  }
 }else{
  const result=await db.query<{id:string}>('INSERT INTO task_comments(id,task_id,author_id,content,mentions) VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING RETURNING id',[requestId||null,task,user,text,people]);
  savedId=result.rows[0]?.id||requestId;
 }
 const item=(await db.query<Remark>(`SELECT ${projection} FROM task_comments c JOIN profiles p ON p.id=c.author_id WHERE c.id=$1 AND c.task_id=$2 AND c.author_id=$3`,[savedId,task,user])).rows[0];
 if(!item||item.content!==text||JSON.stringify([...item.mentions].sort())!==JSON.stringify(people))throw new Error('This update has changed. Reload the remarks before retrying.');
 return item;
}
