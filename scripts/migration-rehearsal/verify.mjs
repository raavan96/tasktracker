import pg from 'pg';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
if (!/^tasktracker_rehearsal_[a-z0-9_]+$/.test(process.env.PGDATABASE || '') || process.env.PGPORT !== '55433') throw new Error('Rehearsal database required.');
const data = JSON.parse(await readFile(process.argv[2], 'utf8'));
const activated = process.argv.includes('--activated');
const db = new pg.Client();
const sorted = rows => rows.map(r => r.id).sort();
try {
 await db.connect();
 const users = activated ? data.users.map(u=>({id:u.id,email:u.email,raw_user_meta_data:u.raw_user_meta_data})) : data.users;
 for (const [table, source] of [['auth.users',users], ...Object.entries(data.rows).map(([k,v])=>['public.'+k,v])]) {
  if (!/^(auth\.users|public\.[a-z_]+)$/.test(table)) throw new Error('Invalid table.');
  const keys = source.length ? Object.keys(source[0]).map(k => '"'+k.replaceAll('"','""')+'"').join(',') : '';
  const { rows } = await db.query(`SELECT count(*)::int n FROM ${table}`);
  assert.equal(rows[0].n,source.length,'Record count mismatch');
  if (keys) {
   const result = await db.query(`WITH original AS (SELECT ${keys} FROM json_populate_recordset(NULL::${table},$1::json)), differences AS ((SELECT ${keys} FROM ${table} EXCEPT ALL SELECT * FROM original) UNION ALL (SELECT * FROM original EXCEPT ALL SELECT ${keys} FROM ${table})) SELECT count(*)::int n FROM differences`,[JSON.stringify(source)]);
   assert.equal(result.rows[0].n,0,'Field mismatch');
  }
 }
 let assertions = 0;
 for (const user of data.rows.profiles) {
  const visible = data.rows.projects.filter(p => user.role === 'admin' || p.created_by === user.id || (!p.is_archived && (!p.is_private || data.rows.project_members.some(m=>m.project_id===p.id&&m.user_id===user.id))));
  const projectIds = new Set(visible.map(p=>p.id));
  await db.query('BEGIN');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user.id]);
  await db.query('SET LOCAL ROLE authenticated');
  for (const [table, expected] of [['projects',visible],['tasks',data.rows.tasks.filter(t=>projectIds.has(t.project_id))],['notifications',data.rows.notifications.filter(n=>n.user_id===user.id)]]) {
   const { rows } = await db.query(`SELECT id FROM ${table}`);
   assert.deepEqual(sorted(rows),sorted(expected),'Visibility mismatch'); assertions++;
  }
  await db.query('ROLLBACK');
 }
 const bad = await db.query("SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='D'");
 assert.equal(bad.rows[0].n,0,'Disabled application trigger');
 const enabled = await db.query(activated ? "SELECT count(*)::int n FROM auth.users WHERE disabled OR password_hash IS NULL OR password_hash !~ '^scrypt-v1\\$[a-f0-9]{32}\\$[a-f0-9]{128}$'" : 'SELECT count(*)::int n FROM auth.users WHERE NOT disabled OR password_hash IS NOT NULL');
 assert.equal(enabled.rows[0].n,0,'Unexpected imported credential state');
 console.log(JSON.stringify({ database: process.env.PGDATABASE, accounts: data.users.length, fieldComparisons: activated ? 'all imported fields except deliberately replaced credentials match' : 'all imported fields match', visibilityAssertions: assertions, applicationTriggers: 'enabled', importedLogins: activated ? 'activated' : 'disabled' }));
} catch (error) { console.error(error.code ? `Verification database error ${error.code}` : error.message.split('\n')[0]); process.exitCode=1; }
finally { await db.end(); }
