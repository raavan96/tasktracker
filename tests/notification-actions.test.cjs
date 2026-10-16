/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadActions(supabaseMock, revalidateMock) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/app/dashboard/notifications/actions.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)((name) => {
    if (name === '@/lib/supabase/server') return { createClient: async () => supabaseMock };
    if (name === 'next/cache') return { revalidatePath: revalidateMock };
    throw new Error(`Unexpected dependency: ${name}`);
  }, mod, mod.exports);
  return mod.exports;
}

test('deleteNotification: deletes all notifications for current user when id is null', async () => {
  const calls = [];
  const revalidated = [];
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-123' } } }),
    },
    from: (table) => {
      calls.push({ table, op: 'from' });
      const builder = {
        delete: () => {
          calls.push({ op: 'delete' });
          return builder;
        },
        eq: (col, val) => {
          calls.push({ op: 'eq', col, val });
          return builder;
        },
        then: (resolve) => resolve({ error: null }),
      };
      return builder;
    },
  };

  const { deleteNotification } = loadActions(supabase, (path, type) => revalidated.push({ path, type }));
  const result = await deleteNotification(null);

  assert.deepEqual(result, { success: true });
  assert.equal(calls.filter(c => c.table === 'notifications').length, 1);
  assert.equal(calls.filter(c => c.op === 'delete').length, 1);
  assert.deepEqual(calls.find(c => c.op === 'eq'), { op: 'eq', col: 'user_id', val: 'user-123' });
  // Should not filter on specific id when null
  assert.equal(calls.filter(c => c.col === 'id').length, 0);
  // Revalidation
  assert.deepEqual(revalidated, [
    { path: '/dashboard', type: 'layout' },
    { path: '/admin', type: 'layout' },
  ]);
});

test('deleteNotification: deletes single notification when id is provided', async () => {
  const calls = [];
  const revalidated = [];
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-123' } } }),
    },
    from: (table) => {
      calls.push({ table, op: 'from' });
      const builder = {
        delete: () => {
          calls.push({ op: 'delete' });
          return builder;
        },
        eq: (col, val) => {
          calls.push({ op: 'eq', col, val });
          return builder;
        },
        then: (resolve) => resolve({ error: null }),
      };
      return builder;
    },
  };

  const { deleteNotification } = loadActions(supabase, (path, type) => revalidated.push({ path, type }));
  const result = await deleteNotification('notif-456');

  assert.deepEqual(result, { success: true });
  assert.equal(calls.filter(c => c.table === 'notifications').length, 1);
  assert.equal(calls.filter(c => c.op === 'delete').length, 1);
  const eqFilters = calls.filter(c => c.op === 'eq');
  assert.deepEqual(eqFilters, [
    { op: 'eq', col: 'user_id', val: 'user-123' },
    { op: 'eq', col: 'id', val: 'notif-456' },
  ]);
});

test('deleteNotification: rejects unauthenticated caller', async () => {
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
    from: () => {
      throw new Error('Should not reach database');
    },
  };

  const { deleteNotification } = loadActions(supabase, () => {});
  const result = await deleteNotification(null);

  assert.deepEqual(result, { error: 'Please sign in again.' });
});

test('deleteNotification: handles database error gracefully', async () => {
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-123' } } }),
    },
    from: () => {
      const builder = {
        delete: () => builder,
        eq: () => builder,
        then: (resolve) => resolve({ error: { message: 'Database failure' } }),
      };
      return builder;
    },
  };

  const { deleteNotification } = loadActions(supabase, () => {});
  const result = await deleteNotification(null);

  assert.deepEqual(result, { error: 'Could not delete notifications. Please try again.' });
});
