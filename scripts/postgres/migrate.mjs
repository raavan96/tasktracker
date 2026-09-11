import pg from 'pg';
import {readFile} from 'node:fs/promises';
// Owner connection is used by this CLI only; never put it in the web service env.
if(!process.env.DATABASE_ADMIN_URL)throw new Error('DATABASE_ADMIN_URL is required.');
const db=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
try{await db.connect();await db.query('SELECT pg_advisory_lock(90261101)');
const {rows}=await db.query("SELECT to_regclass('public.profiles') existing");
if(rows[0].existing)throw new Error('Refusing to initialize an existing workspace. Use a new staging database.');
for(const file of ['001_base.sql','002_review.sql','003_workspace.sql','004_automation.sql','005_runtime.sql']){
await db.query(await readFile(new URL('../../postgres/'+file,import.meta.url),'utf8'));console.log('Applied '+file);}
console.log('Staging schema installed. Set a runtime role password separately using psql \\password.');}
catch(error){console.error('Migration failed:',error.message);process.exitCode=1;}
finally{await db.end();}
