// Read-only Supabase export. Destination must be a new, private directory.
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
const destination = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Provide a new private export directory.');
process.loadEnvFile(process.env.SOURCE_ENV_FILE || '.env.local');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const tables = ['profiles','projects','project_members','tasks','project_notes','task_comments','notifications','task_checklist','task_dependencies','task_history','task_attachments'];
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
async function snapshot() {
  const rows = {};
  for (const table of tables) {
    rows[table] = [];
    for (let offset = 0;; offset += 500) {
      let query = client.from(table).select('*').order(table === 'task_dependencies' ? 'task_id' : 'id');
      if (table === 'task_dependencies') query = query.order('depends_on');
      const { data, error } = await query.range(offset, offset + 499);
      if (error) throw new Error(`Cannot export ${table}: ${error.code}`);
      rows[table].push(...data);
      if (data.length < 500) break;
    }
  }
  const users = [];
  for (let page = 1;; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw new Error('Cannot read auth users.');
    users.push(...data.users.map(u => ({ id: u.id, email: u.email, raw_user_meta_data: u.user_metadata, password_hash: null, disabled: true })));
    if (data.users.length < 500) break;
  }
  users.sort((a,b) => a.id.localeCompare(b.id));
  return { users, rows };
}
await mkdir(destination, { mode: 0o700 });
const first = await snapshot();
const files = [];
for (const attachment of first.rows.task_attachments) {
  const path = attachment.storage_path;
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]{1,150}$/.test(path) || path.split('/').some(p => p === '.' || p === '..')) throw new Error('Unsupported attachment path; stop for explicit mapping.');
  const { data, error } = await client.storage.from('task-files').download(path);
  if (error) throw new Error('Cannot download a referenced attachment.');
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== Number(attachment.size)) throw new Error('Attachment size mismatch.');
  const target = join(destination, 'attachments', path);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, bytes, { mode: 0o600, flag: 'wx' });
  files.push({ path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const second = await snapshot();
if (digest(first) !== digest(second)) throw new Error('Source changed during export; retry into a new directory.');
const summary = { exportedAt: new Date().toISOString(), sourceHash: digest(first), counts: { users: first.users.length, ...Object.fromEntries(tables.map(t => [t, first.rows[t].length])) }, attachmentBytes: files.reduce((s,f) => s+f.size,0), passwordMigration: 'Not available through Admin API; imported users disabled.', consistency: 'Two matching API reads, not a transactional production snapshot.' };
await writeFile(join(destination, 'data.json'), JSON.stringify({ ...first, files, summary }), { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify(summary));
