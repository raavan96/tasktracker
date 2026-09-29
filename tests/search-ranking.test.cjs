/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

test('UX-11: Search ranking prioritizes direct title matches over body matches', async () => {
  const db = new PGlite();

  // Load migrations up to archiving and shared assignments
  const read = f => fs.readFileSync(new URL('../postgres/' + f, 'file://' + __filename), 'utf8');
  for (const f of [
    '001_base.sql',
    '002_review.sql',
    '003_workspace.sql',
    '004_automation.sql',
    '005_runtime.sql',
    '006_archiving.sql',
    '007_people_review.sql',
    '008_reporting_collaboration.sql',
  ]) {
    await db.exec(read(f));
  }

  const admin = '00000000-0000-0000-0000-000000000001';
  const owner = '00000000-0000-0000-0000-000000000002';
  const member = '00000000-0000-0000-0000-000000000003';
  const outsider = '00000000-0000-0000-0000-000000000004';

  for (const [id, role] of [
    [admin, 'admin'],
    [owner, 'member'],
    [member, 'member'],
    [outsider, 'member'],
  ]) {
    await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [id, id + '@collegedunia.com']);
    await db.query('INSERT INTO profiles(id,email,full_name,role) VALUES($1,$2,$3,$4)', [
      id,
      id + '@collegedunia.com',
      role,
      role,
    ]);
  }

  async function as(id) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id || '']);
    if (id) await db.exec('SET ROLE authenticated');
  }

  let currentActor = owner;
  const dataExports = {};
  new Function(
    'exports',
    'require',
    ts.transpileModule(fs.readFileSync(new URL('../src/lib/workspace-data.ts', 'file://' + __filename), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
  )(dataExports, name => {
    if (name === 'server-only') return {};
    if (name === './postgres/auth') return { currentUser: async () => ({ id: currentActor }) };
    if (name === './postgres/db')
      return {
        transaction: async (id, work) => {
          await as(id);
          return work(db, id);
        },
      };
    throw new Error('Unexpected dependency ' + name);
  });

  // Setup projects and tasks as owner
  await as(owner);

  // 5 projects with "usability" only in description (audit evidence)
  const p1 = (await db.query("SELECT create_workspace_project('Alpha Analytics', 'Usability evaluation and tracking for web apps', ARRAY[$1::uuid], true) id", [member])).rows[0].id;
  const p2 = (await db.query("SELECT create_workspace_project('Beta Billing', 'Improving general usability of client invoices', ARRAY[$1::uuid], true) id", [member])).rows[0].id;
  const p3 = (await db.query("SELECT create_workspace_project('Gamma Gateway', 'System usability reports and latency monitors', ARRAY[$1::uuid], true) id", [member])).rows[0].id;
  const p4 = (await db.query("SELECT create_workspace_project('Delta Dispatch', 'Usability testing requirements for fleet dispatch', ARRAY[$1::uuid], true) id", [member])).rows[0].id;
  const p5 = (await db.query("SELECT create_workspace_project('Epsilon Engine', 'Overall usability and error messaging', ARRAY[$1::uuid], true) id", [member])).rows[0].id;

  // 1 core project with target tasks, notes, remarks
  const coreProj = (await db.query("SELECT create_workspace_project('Core UX', 'Normal project description', ARRAY[$1::uuid], true) id", [member])).rows[0].id;

  // Tasks:
  // t1: Exact title match
  const tExact = (await db.query("INSERT INTO tasks(project_id, title, description, created_by) VALUES($1, 'Usability', 'Top priority item', $2) RETURNING id", [coreProj, owner])).rows[0].id;
  // t2: Prefix title match
  await db.query("INSERT INTO tasks(project_id, title, description, created_by) VALUES($1, 'Usability testing protocols', 'Run protocol check', $2)", [coreProj, owner]);
  // t3: Direct task-title match (word in title)
  await db.query("INSERT INTO tasks(project_id, title, description, created_by) VALUES($1, 'Review usability findings', 'Check feedback notes', $2)", [coreProj, owner]);
  // t4: Body-only match task
  await db.query("INSERT INTO tasks(project_id, title, description, created_by) VALUES($1, 'Design System Audit', 'Deep dive into usability across buttons', $2)", [coreProj, owner]);

  // Note: note with usability in title vs body
  await db.query("INSERT INTO project_notes(project_id, author_id, title, content) VALUES($1, $2, 'Usability Checklist', 'Points to check')", [coreProj, owner]);
  await db.query("INSERT INTO project_notes(project_id, author_id, title, content) VALUES($1, $2, 'Sprint Retrospective', 'Notes on usability feedback')", [coreProj, owner]);

  // Remark: comment on a neutral task discussing usability
  const tNeutral = (await db.query("INSERT INTO tasks(project_id, title, description, created_by) VALUES($1, 'Fix button contrast', 'Contrast fix', $2) RETURNING id", [coreProj, owner])).rows[0].id;
  const cRemark = (await db.query("INSERT INTO task_comments(task_id, author_id, content) VALUES($1, $2, 'Remark discussing usability hurdles') RETURNING id", [tNeutral, owner])).rows[0].id;

  // Execute search for "usability"
  currentActor = owner;
  const searchResult = await dataExports.searchWorkspace('usability', false, 1);
  assert.ok(searchResult.total >= 8, 'Expected at least 8 results matching usability');

  const titles = searchResult.items.map(i => ({ kind: i.kind, title: i.title, id: i.id }));

  // 1. Exact title match "Usability" MUST be #1
  assert.equal(titles[0].title, 'Usability');
  assert.equal(titles[0].kind, 'Task');

  // 2. Prefix title matches "Usability testing protocols" and "Usability Checklist" MUST be next
  const top3Titles = titles.slice(0, 3).map(t => t.title);
  assert.ok(top3Titles.includes('Usability testing protocols'), 'Expected prefix task in top 3');
  assert.ok(top3Titles.includes('Usability Checklist'), 'Expected prefix note in top 3');

  // 3. Direct task-title match "Review usability findings" MUST rank ahead of the 5 body-only projects
  const reviewIdx = titles.findIndex(t => t.title === 'Review usability findings' && t.kind === 'Task');
  assert.ok(reviewIdx !== -1, 'Review usability findings must be present');

  const projectIndices = [p1, p2, p3, p4, p5].map(pid => titles.findIndex(t => t.id === pid));
  for (const pIdx of projectIndices) {
    if (pIdx !== -1) {
      assert.ok(
        reviewIdx < pIdx,
        `Direct task-title match (index ${reviewIdx}) must rank before description-only project (index ${pIdx})`
      );
    }
  }

  // 4. Notes and remarks remain discoverable
  assert.ok(titles.some(t => t.kind === 'Project note'), 'Project notes must remain discoverable');
  assert.ok(titles.some(t => t.kind === 'Task remark'), 'Task remarks must remain discoverable');

  // 5. Highlighted excerpt is populated
  const remarkItem = searchResult.items.find(i => i.kind === 'Task remark' && i.id === cRemark);
  assert.ok(remarkItem, 'Remark item must be found');
  assert.ok(remarkItem.body.includes('[[HL]]usability[[/HL]]') || remarkItem.body.includes('[[HL]]Usability[[/HL]]'), 'Remark excerpt must have highlight markers');

  // 6. Permission check: Outsider cannot see private project results
  currentActor = outsider;
  const outsiderResult = await dataExports.searchWorkspace('usability', true, 1);
  assert.equal(outsiderResult.total, 0, 'Outsider must not see private project or task results');

  // 7. Archived filtering
  await as(null);
  await db.query("UPDATE tasks SET status = 'done' WHERE id = $1", [tExact]);
  await db.query('UPDATE tasks SET is_archived = true WHERE id = $1', [tExact]);
  await as(owner);

  currentActor = owner;
  const activeOnly = await dataExports.searchWorkspace('Usability', false, 1);
  assert.ok(!activeOnly.items.some(t => t.id === tExact), 'Archived task must be hidden when archived=false');

  const withArchived = await dataExports.searchWorkspace('Usability', true, 1);
  assert.ok(withArchived.items.some(t => t.id === tExact && t.archived), 'Archived task must be present when archived=true');
});
