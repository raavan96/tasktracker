// Run only on the isolated staging installation, with its owner socket connection.
import pg from 'pg';import fs from 'node:fs/promises';import {randomBytes,randomUUID,scrypt as callback} from 'node:crypto';import {promisify} from 'node:util';
if(process.env.PGPORT!=='55433'||process.env.PGDATABASE!=='tasktracker_staging')throw new Error('Only the isolated staging database is allowed.');
const dir=process.argv[2];if(!dir?.startsWith('/var/lib/pgsql/tasktracker-staging/load-'))throw new Error('Use a dedicated staging load directory.');
await fs.mkdir(dir,{mode:0o700});
const runId=randomUUID(),password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
const key=await promisify(callback)(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
const db=new pg.Client();await db.connect();
try{
 await db.query('BEGIN');const actors=[];
 for(let n=0;n<8;n++){
  const id=randomUUID(),email=`load-${runId.slice(0,8)}-${n}@collegedunia.com`;
  await db.query('INSERT INTO auth.users(id,email,password_hash) VALUES($1,$2,$3)',[id,email,`scrypt-v1$${salt}$${key.toString('hex')}`]);
  await db.query('INSERT INTO profiles(id,email,full_name,role) VALUES($1,$2,$3,$4)',[id,email,`Temporary load tester ${n+1}`,n===0?'admin':'member']);
  actors.push({id,email,password,tasks:[]});
 }
 const project=randomUUID(),privateProject=randomUUID(),privateTask=randomUUID();
 for(const [id,name] of [[project,'Temporary eight-session load test'],[privateProject,'Temporary private access test']]){
  await db.query('INSERT INTO projects(id,name,created_by,is_private) VALUES($1,$2,$3,true)',[id,name,actors[0].id]);
 }
 for(const actor of actors)await db.query('INSERT INTO project_members(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[project,actor.id]);
 await db.query('INSERT INTO project_members(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[privateProject,actors[1].id]);
 for(let n=0;n<8;n++)for(let k=0;k<4;k++){
  const id=randomUUID();await db.query("INSERT INTO tasks(id,project_id,title,created_by,assignee_id,due_date) VALUES($1,$2,$3,$4,$5,current_date+1)",[id,project,`Load test ${n+1} task ${k+1}`,actors[n].id,actors[(n+1)%8].id]);actors[n].tasks.push(id);
 }
 await db.query('INSERT INTO tasks(id,project_id,title,created_by) VALUES($1,$2,$3,$4)',[privateTask,privateProject,'Private access verification',actors[0].id]);
 const manifest=JSON.parse(await fs.readFile('/opt/tasktracker-staging/.next/server/server-reference-manifest.json','utf8'));
 const actions=Object.fromEntries(Object.entries(manifest.node).filter(([,v])=>v.exportedName).map(([id,v])=>[v.exportedName,id]));
 await fs.writeFile(dir+'/run.json',JSON.stringify({runId,project,privateProject,privateTask,actors,actions}),{mode:0o600,flag:'wx'});
 await db.query('COMMIT');console.log('Prepared eight temporary staging users and scoped projects.');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
