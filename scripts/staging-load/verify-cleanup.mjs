// Removes only the accounts, projects and task file directories in this run manifest.
import pg from 'pg';import fs from 'node:fs/promises';
if(process.env.PGPORT!=='55433'||process.env.PGDATABASE!=='tasktracker_staging')throw new Error('Staging only.');
const dir=process.argv[2];if(!/^\/var\/lib\/pgsql\/tasktracker-staging\/load-[a-zA-Z0-9-]+$/.test(dir||''))throw new Error('Invalid run directory.');
const config=JSON.parse(await fs.readFile(dir+'/run.json','utf8'));
const ids=config.actors.map(a=>a.id),projects=[config.project,config.privateProject];
if(ids.length!==8||new Set(ids).size!==8||!config.runId)throw new Error('Invalid run manifest');
const db=new pg.Client();await db.connect();let taskIds=[];
try{
 const {rows:members}=await db.query('SELECT id,email FROM profiles WHERE id=ANY($1::uuid[])',[ids]);
 if(members.length!==8||members.some(m=>!m.email.startsWith('load-'+config.runId.slice(0,8)+'-')))throw new Error('Test-user ownership mismatch');
 const tasks=await db.query('SELECT id,status FROM tasks WHERE project_id=ANY($1::uuid[])',[projects]);taskIds=tasks.rows.map(t=>t.id);
 const stats=(await db.query('SELECT (SELECT count(*) FROM task_comments WHERE task_id=ANY($1::uuid[]))::int comments,(SELECT count(*) FROM task_history WHERE task_id=ANY($1::uuid[]))::int history,(SELECT count(*) FROM task_attachments WHERE task_id=ANY($1::uuid[]))::int attachments',[taskIds])).rows[0];
 const review=tasks.rows.find(t=>t.id===config.actors[1].tasks[0]);
 const result={...stats,taskCount:tasks.rows.length,reviewTaskStatus:review?.status};
 const expectedComments=Number(process.argv[3]);
 if(!Number.isInteger(expectedComments)||expectedComments<1||stats.comments!==expectedComments||stats.attachments!==8||tasks.rows.length!==33||review?.status!=='done')throw new Error('Persisted results did not match the completed workload; preserve data for inspection.');
 await fs.writeFile(dir+'/verified-counts.json',JSON.stringify(result,null,2),{mode:0o600});console.log('Persisted staging test results:',JSON.stringify(result));
 await db.query('BEGIN');
 const removed=await db.query('DELETE FROM projects WHERE id=ANY($1::uuid[]) AND created_by=$2 RETURNING id',[projects,ids[0]]);
 if(removed.rowCount!==2)throw new Error('Project ownership mismatch');
 await db.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])',[ids]);await db.query('COMMIT');
 await fs.writeFile(dir+'/file-cleanup.json',JSON.stringify(taskIds),{mode:0o600});
 console.log('Removed the two temporary projects, eight users, and their sessions. File cleanup manifest is ready.');
}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{await db.end();}
