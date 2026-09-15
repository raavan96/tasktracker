import type {PoolClient} from 'pg';
export type BulkChange={action:'deadline'|'assign'|'archive';deadline?:string;assignee_ids?:string[]};
export type BulkSelection={id:string;version:number};
export type BulkResult={id:string;title:string;eligible:boolean;reason:string};
export async function bulkTasks(db:Pick<PoolClient,'query'>,user:string,selection:BulkSelection[],change:BulkChange,apply=false){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!Array.isArray(selection)||selection.length<1||selection.length>50||new Set(selection.map(x=>x.id)).size!==selection.length||selection.some(x=>!uuid.test(x.id)||!Number.isSafeInteger(x.version)||x.version<0))throw new Error('Select up to 50 tasks from the current results.');
 if(!['deadline','assign','archive'].includes(change.action))throw new Error('Choose a bulk action.');
 if(change.action==='deadline'&&(!change.deadline||!/^\d{4}-\d{2}-\d{2}$/.test(change.deadline)||!Number.isFinite(Date.parse(change.deadline))||new Date(change.deadline).toISOString().slice(0,10)!==change.deadline))throw new Error('Choose a valid deadline.');
 const assignees=[...new Set(change.assignee_ids||[])];
 if(change.action==='assign'&&(!Array.isArray(change.assignee_ids)||!assignees.length||assignees.length>30||assignees.some(id=>!uuid.test(id))))throw new Error('Select 1–30 assignees.');
 const result:BulkResult[]=[];
 // Stable lock order avoids deadlocks between overlapping batches.
 for(const selected of [...selection].sort((a,b)=>a.id.localeCompare(b.id))){
  await db.query('SAVEPOINT bulk_item');let title='Unavailable task';
  try{
   const task=(await db.query('SELECT t.*,p.is_archived project_archived,public.is_admin() admin,public.can_work_project(t.project_id) can_work FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=$1'+(apply?' FOR UPDATE OF t':''),[selected.id])).rows[0];
   if(!task)throw new Error('Task unavailable or access removed.');title=task.title;
   if(!task.can_work||(!task.admin&&task.created_by!==user))throw new Error('Only the creator or an admin can make this change.');
   if(task.is_archived||task.project_archived)throw new Error('Restore archived work first.');
   if(Number(task.review_version)!==selected.version)throw new Error('Task changed since selection. Refresh and select it again.');
   if(change.action==='archive'&&task.status!=='done')throw new Error('Only completed tasks can be archived.');
   if(change.action!=='archive'&&['done','in_review'].includes(task.status))throw new Error('Completed or submitted work cannot be edited in bulk.');
   if(change.action==='assign'){
    const valid=(await db.query('SELECT p.id FROM profiles p JOIN project_members m ON m.user_id=p.id WHERE m.project_id=$1 AND p.is_active AND p.id=ANY($2::uuid[])',[task.project_id,assignees])).rows;
    if(valid.length!==assignees.length)throw new Error('Every assignee must be an active member of this project.');
   }
   if(apply){
    if(change.action==='archive')await db.query("SELECT set_archive('task',$1,true)",[task.id]);
    else if(change.action==='deadline'){const changed=await db.query('UPDATE tasks SET due_date=$1 WHERE id=$2 AND review_version=$3 RETURNING id',[change.deadline,task.id,selected.version]);if(changed.rows.length!==1)throw new Error('Access or task version changed.');}
    else {const changed=await db.query('UPDATE tasks SET assignee_ids=$1,assignee_id=$2 WHERE id=$3 AND review_version=$4 RETURNING id',[assignees,assignees[0],task.id,selected.version]);if(changed.rows.length!==1)throw new Error('Access or task version changed.');}
   }
   result.push({id:selected.id,title,eligible:true,reason:apply?'Updated':'Ready'});
   await db.query('RELEASE SAVEPOINT bulk_item');
  }catch(e){await db.query('ROLLBACK TO SAVEPOINT bulk_item');await db.query('RELEASE SAVEPOINT bulk_item');result.push({id:selected.id,title,eligible:false,reason:e instanceof Error?e.message:'Could not update this task.'});}
 }
 return result;
}
