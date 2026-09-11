// Owner-only CLI for an initialized, empty rehearsal database. Never production.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
const database = process.env.PGDATABASE;
if (!/^tasktracker_rehearsal_[a-z0-9_]+$/.test(database || '') || process.env.PGPORT !== '55433') throw new Error('Only isolated rehearsal databases on port 55433 are allowed.');
const data = JSON.parse(await readFile(process.argv[2], 'utf8'));
const names = ['profiles','projects','project_members','tasks','project_notes','task_comments','notifications','task_checklist','task_dependencies','task_history','task_attachments'];
if (Object.keys(data.rows).sort().join() !== [...names].sort().join()) throw new Error('Unexpected export tables.');
const db = new pg.Client();
const quote = s => '"' + s.replaceAll('"','""') + '"';
try {
  await db.connect();
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(90261102)');
  for (const table of ['auth.users', ...names.map(n => 'public.' + n)]) {
    const [schema, name] = table.split('.');
    const target = `${quote(schema)}.${quote(name)}`;
    const { rows: existing } = await db.query(`SELECT count(*)::int n FROM ${target}`);
    if (existing[0].n) throw new Error(`Refusing nonempty ${table}.`);
    // Skip application side effects; foreign-key and CHECK constraints remain active.
    await db.query(`ALTER TABLE ${target} DISABLE TRIGGER USER`);
    const source = table === 'auth.users' ? data.users : data.rows[name];
    if (table === 'auth.users' && source.some(u => u.disabled !== true || u.password_hash !== null)) throw new Error('Rehearsal accounts must be disabled.');
    const { rows: columns } = await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2', [schema,name]);
    const allowed = new Set(columns.map(c => c.column_name));
    const keys = [...new Set(source.flatMap(row => Object.keys(row)))].sort();
    for (const key of keys) if (!allowed.has(key)) throw new Error(`Unmapped source column ${table}.${key}.`);
    if (source.length) {
      if (source.some(row => keys.some(key => !Object.hasOwn(row,key)))) throw new Error(`Inconsistent row columns in ${table}.`);
      const selection = keys.map(quote).join(',');
      await db.query(`INSERT INTO ${target} (${selection}) SELECT ${selection} FROM json_populate_recordset(NULL::${target},$1::json)`, [JSON.stringify(source)]);
      // PostgreSQL normalizes timestamps; compare using the target's own types.
      const { rows } = await db.query(`WITH original AS (SELECT ${selection} FROM json_populate_recordset(NULL::${target},$1::json)), differences AS ((SELECT ${selection} FROM ${target} EXCEPT ALL SELECT * FROM original) UNION ALL (SELECT * FROM original EXCEPT ALL SELECT ${selection} FROM ${target})) SELECT count(*)::int n FROM differences`, [JSON.stringify(source)]);
      if (rows[0].n) throw new Error(`Round-trip mismatch in ${table}.`);
    }
    await db.query(`ALTER TABLE ${target} ENABLE TRIGGER USER`);
    console.log(`Verified ${table}: ${source.length} rows`);
  }
  await db.query('COMMIT');
  console.log('Import committed; all imported fields match and foreign keys remained enforced. Accounts disabled.');
} catch (error) {
  await db.query('ROLLBACK').catch(() => {});
  // Database details may contain user content; log only controlled errors/codes.
  console.error(error.code ? `Database rejected import (${error.code}). No import committed.` : error.message);
  process.exitCode = 1;
} finally { await db.end(); }
