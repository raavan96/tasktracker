/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load real TS action modules with a fake Supabase boundary. Never contacts a database.
function load(filename, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)((name) => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, mod, mod.exports);
  return mod.exports;
}
const types = load('src/lib/task-types.ts', {});
function form(values = {}) {
  const data = new FormData();
  for (const [k,v] of Object.entries({ title: 'Review launch', description: 'Confirm details', priority: 'high', status: 'todo', assigneeId: '', dueDate: '', ...values })) data.set(k,v);
  return data;
}
function setup({ user = { id: 'admin' }, role = 'admin', member = true, assignee = true, task = { id: 'task', created_by: 'creator', assignee_id: 'member' }, writeError = null, zeroRows = false } = {}) {
  const writes = []; const queries = []; const invalidated = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table) {
      const q = { table, filters: [], operation: 'select', payload: null }; queries.push(q);
      const builder = {
        select() { return builder; },
        eq(key,value) { q.filters.push([key,value]); return builder; },
        insert(payload) { q.operation = 'insert'; q.payload = payload; return builder; },
        update(payload) { q.operation = 'update'; q.payload = payload; return builder; },
        delete() { q.operation = 'delete'; return builder; },
        single() { return execute(); }, maybeSingle() { return execute(); },
        then(resolve,reject) { return execute().then(resolve,reject); }
      };
      async function execute() {
        if (q.operation !== 'select') { writes.push(q); return { data: zeroRows ? null : { id: 'saved' }, error: writeError }; }
        let data;
        if (table === 'profiles') data = { role };
        if (table === 'projects') data = { id: 'project', is_archived: false };
        if (table === 'tasks') data = task;
        if (table === 'project_members') data = q.filters.some(([k,v]) => k === 'user_id' && v === 'outsider') ? (assignee ? { user_id: 'outsider' } : null) : (member ? { user_id: user?.id } : null);
        return { data, error: null };
      }
      return builder;
    }
  };
  const access = load('src/lib/project-access.ts', { '@/lib/supabase/server': { createClient: async () => supabase } });
  const actions = load('src/app/dashboard/tasks/actions.ts', { '@/lib/project-access': access, '@/lib/task-types': types, 'next/cache': { revalidatePath: p => invalidated.push(p) } });
  return { actions, writes, queries, invalidated, access };
}

test('task form rejects blank titles, invalid enums and impossible dates', () => {
  for (const values of [{title:'   '}, {priority:'critical'}, {status:'unknown'}, {dueDate:'2026-02-30'}, {dueDate:'invalid'}]) assert.ok(types.parseTaskForm(form(values)).error);
  assert.equal(types.parseTaskForm(form({dueDate:'2028-02-29'})).data.due_date, '2028-02-29');
});
test('signed-out callers cannot create tasks', async () => {
  const t = setup({user:null}); assert.ok((await t.actions.createTask('project',form())).error); assert.equal(t.writes.length,0);
});
test('nonmembers cannot create or comment on project tasks', async () => {
  const t = setup({user:{id:'member'}, role:'member', member:false});
  assert.ok((await t.actions.createTask('project',form())).error);
  assert.ok((await t.actions.addComment('task','project','Hello')).error); assert.equal(t.writes.length,0);
});
test('assignees must belong to the target project', async () => {
  const t = setup({assignee:false}); assert.ok((await t.actions.updateTask('task','project',form({assigneeId:'outsider'}))).error); assert.equal(t.writes.length,0);
});
test('successful edit persists all fields, scopes by project, and refreshes all task views', async () => {
  const t = setup(); const result = await t.actions.updateTask('task','project',form({title:'  Revised task  ',status:'blocked',dueDate:'2026-10-01'}));
  assert.equal(result.success,true); assert.equal(t.writes[0].payload.title,'Revised task'); assert.equal(t.writes[0].payload.status,'blocked');
  assert.deepEqual(t.writes[0].filters,[['id','task'],['project_id','project']]);
  assert.deepEqual(t.invalidated,['/dashboard/projects/project','/dashboard/my-tasks','/dashboard']);
});
test('assignee may update status but cannot rewrite another creator’s task', async () => {
  const t = setup({user:{id:'member'},role:'member'});
  assert.ok((await t.actions.updateTask('task','project',form())).error);
  assert.equal((await t.actions.updateTaskStatus('task','project','done')).success,true); assert.equal(t.writes.length,1);
});
test('missing tasks and writes rejected by RLS never return success', async () => {
  const missing=setup({task:null}); assert.ok((await missing.actions.updateTask('task','project',form())).error); assert.equal(missing.writes.length,0);
  const rejected=setup({zeroRows:true}); assert.ok((await rejected.actions.updateTaskStatus('task','project','done')).error); assert.equal(rejected.invalidated.length,0);
});
test('database failures are returned to the form', async () => {
  const t=setup({writeError:{message:'Permission denied'}}); assert.equal((await t.actions.createTask('project',form())).error,'Permission denied'); assert.equal(t.invalidated.length,0);
});
test('comments keep author attribution and reject empty text', async () => {
  const t=setup(); assert.ok((await t.actions.addComment('task','project',' ')).error);
  assert.equal((await t.actions.addComment('task','project','  New update  ')).success,true);
  assert.deepEqual(t.writes[0].payload,{task_id:'task',author_id:'admin',content:'New update'});
});
test('only admins can manage project membership', async () => {
  const t=setup({user:{id:'member'},role:'member'}); assert.ok((await t.access.projectAccess('project',true)).error); assert.equal(t.writes.length,0);
});
