// Deliberate activation of imported rehearsal accounts; password arrives on stdin.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
if (process.env.PGDATABASE !== 'tasktracker_rehearsal_20260911' || process.env.PGPORT !== '55433') throw new Error('Only the approved rehearsal database is allowed.');
let input = '';
for await (const chunk of process.stdin) { input += chunk; if (input.length > 4096) throw new Error('Input too large.'); }
const { password } = JSON.parse(input);
if (typeof password !== 'string' || password.length < 8 || password.length > 256) throw new Error('Password must contain 8–256 characters.');
const exported = JSON.parse(await readFile(process.argv[2], 'utf8'));
const ids = exported.users.map(u => u.id).sort();
const db = new pg.Client();
try {
 await db.connect();
 await db.query('BEGIN');
 await db.query('SELECT pg_advisory_xact_lock(90261102)');
 const { rows: users } = await db.query('SELECT id,email FROM auth.users ORDER BY id FOR UPDATE');
 if (JSON.stringify(users.map(u=>u.id).sort()) !== JSON.stringify(ids) || !ids.length) throw new Error('Account set does not match the approved export.');
 for (const user of users) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  const encoded = `scrypt-v1$${salt}$${key.toString('hex')}`;
  await db.query('UPDATE auth.users SET password_hash=$1,disabled=false WHERE id=$2',[encoded,user.id]);
  await db.query('DELETE FROM auth.sessions WHERE user_id=$1',[user.id]);
  await db.query('DELETE FROM auth.login_attempts WHERE key=$1',[createHash('sha256').update(user.email.trim().toLowerCase()).digest('hex')]);
 }
 const { rows: saved } = await db.query('SELECT password_hash,disabled FROM auth.users');
 for (const user of saved) {
  const [version,salt,key] = user.password_hash.split('$');
  const actual = await derive(password,salt,64,options);
  if (version !== 'scrypt-v1' || user.disabled || !timingSafeEqual(actual,Buffer.from(key,'hex'))) throw new Error('Stored credential verification failed.');
 }
 await db.query('COMMIT');
 console.log(JSON.stringify({database:process.env.PGDATABASE,accountsUpdated:users.length,storedPasswordsVerified:saved.length,oldSessionsRevoked:true}));
} catch(error) { await db.query('ROLLBACK').catch(()=>{}); console.error(error.code ? `Database error ${error.code}` : error.message); process.exitCode=1; }
finally { await db.end(); }
