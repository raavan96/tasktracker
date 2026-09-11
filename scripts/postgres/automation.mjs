import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL,statement_timeout:60000});
try{await db.connect();await db.query('BEGIN');await db.query('SET LOCAL ROLE service_role');
await db.query('SELECT run_workspace_automation()');await db.query('COMMIT');
await db.query("DELETE FROM auth.sessions WHERE expires_at<now()");
await db.query("DELETE FROM auth.login_attempts WHERE window_start<now()-interval '1 day'");
console.log('Local recurring tasks and reminders processed.');}
catch(error){console.error('Automation failed:',error.message);process.exitCode=1;}
finally{await db.end();}
