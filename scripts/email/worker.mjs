import pg from 'pg';
import {mailifyConfig,sendMailify} from './mailify.mjs';
import {processOneEmail} from './queue.mjs';
// Both this deployment switch and the database switch must be enabled.
if(process.env.MAILIFY_NOTIFICATIONS_ENABLED!=='true'){console.log('Team email delivery is disabled.');process.exit(0);}
pg.types.setTypeParser(1082,value=>value);
const config=mailifyConfig();
const db=new pg.Client({connectionString:process.env.DATABASE_URL,statement_timeout:10000,connectionTimeoutMillis:5000});
try {
 await db.connect();await db.query('SET ROLE service_role');
 if(!(await db.query('SELECT pg_try_advisory_lock(90261512) locked')).rows[0].locked)process.exitCode=0;
 else {
  // A worker could stop after the provider received a request. Never resend it.
  await db.query("UPDATE email_queue SET state='unconfirmed',finished_at=now() WHERE state='attempting' AND attempted_at<now()-interval '5 minutes'");
  await db.query('SELECT queue_deadline_emails()');
  await db.query('SELECT queue_weekly_emails()');
  let processed=0;
  while(processed<10&&await processOneEmail(db,mail=>sendMailify({recipient:mail.recipient,subject:mail.subject,content:mail.html},config)))processed++;
  console.log(`Processed ${processed} email queue items. Accepted does not mean delivered; unconfirmed items are not retried.`);
 }
} catch {console.error('Email worker failed. Check the queue before any manual retry.');process.exitCode=1;}
finally {await db.end();}
