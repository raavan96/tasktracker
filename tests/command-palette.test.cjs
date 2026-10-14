/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ts = require('typescript');

// Transpile command-palette-items.ts to CommonJS for testing
const paletteExports = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/command-palette-items.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(paletteExports);

const {
  getStaticCommands,
  filterAndRankCommands,
  groupCommandsByCategory,
  getNextSelectableIndex,
} = paletteExports;

test('Command palette static items: non-admin has actions and core navigation, no admin-only routes', () => {
  const items = getStaticCommands({ isAdmin: false });
  assert.ok(Array.isArray(items));
  assert.ok(items.length >= 10);

  const ids = items.map(i => i.id);
  assert.ok(ids.includes('action-standup'), 'should include standup action');
  assert.ok(ids.includes('action-theme'), 'should include theme toggle action');
  assert.ok(ids.includes('action-chat'), 'should include chat action');
  assert.ok(ids.includes('action-new-project'), 'should include new project action');
  assert.ok(ids.includes('nav-focus'), 'should include focus / action center');
  assert.ok(ids.includes('nav-my-tasks'), 'should include my tasks');
  assert.ok(ids.includes('nav-all-tasks'), 'should include all tasks');
  assert.ok(ids.includes('nav-calendar'), 'should include calendar');
  assert.ok(ids.includes('nav-reports'), 'should include reports');
  assert.ok(ids.includes('nav-archive'), 'should include archive');

  // Verify non-admin does NOT have admin workload/user management
  assert.ok(!ids.includes('nav-workload'), 'non-admin should not see workload');
  assert.ok(!ids.includes('nav-users'), 'non-admin should not see user management');
});

test('Command palette static items: admin includes workload and team user management', () => {
  const items = getStaticCommands({ isAdmin: true });
  const ids = items.map(i => i.id);

  assert.ok(ids.includes('nav-workload'), 'admin should see workload');
  assert.ok(ids.includes('nav-users'), 'admin should see team users management');
});

test('filterAndRankCommands: empty or whitespace query returns all items in original order', () => {
  const items = getStaticCommands({ isAdmin: false });
  assert.deepEqual(filterAndRankCommands(items, ''), items);
  assert.deepEqual(filterAndRankCommands(items, '   '), items);
});

test('filterAndRankCommands: exact and prefix title matches rank highest', () => {
  const items = getStaticCommands({ isAdmin: true });

  const standupResults = filterAndRankCommands(items, 'standup');
  assert.ok(standupResults.length >= 1);
  assert.equal(standupResults[0].id, 'action-standup');

  const calendarResults = filterAndRankCommands(items, 'calendar');
  assert.ok(calendarResults.length >= 1);
  assert.equal(calendarResults[0].id, 'nav-calendar');

  const focusResults = filterAndRankCommands(items, 'focus');
  assert.ok(focusResults.length >= 1);
  assert.equal(focusResults[0].id, 'nav-focus');
});

test('filterAndRankCommands: keyword matching finds relevant commands', () => {
  const items = getStaticCommands({ isAdmin: true });

  // Query "dark" or "appearance" should match theme toggle
  const themeResults = filterAndRankCommands(items, 'dark');
  assert.ok(themeResults.length >= 1);
  assert.equal(themeResults[0].id, 'action-theme');

  // Query "metrics" should match reports
  const metricsResults = filterAndRankCommands(items, 'metrics');
  assert.ok(metricsResults.length >= 1);
  assert.equal(metricsResults[0].id, 'nav-reports');

  // Query "slack" should match standup
  const slackResults = filterAndRankCommands(items, 'slack');
  assert.ok(slackResults.length >= 1);
  assert.equal(slackResults[0].id, 'action-standup');
});

test('filterAndRankCommands: case insensitivity and trimmed inputs', () => {
  const items = getStaticCommands({ isAdmin: true });

  const upperResults = filterAndRankCommands(items, '  MY TASKS  ');
  assert.ok(upperResults.length >= 1);
  assert.equal(upperResults[0].id, 'nav-my-tasks');
});

test('groupCommandsByCategory: groups items in strict priority order Actions -> Navigation -> Projects -> Tasks', () => {
  const mixed = [
    { id: '1', title: 'Task 1', category: 'Tasks' },
    { id: '2', title: 'Action 1', category: 'Actions' },
    { id: '3', title: 'Project 1', category: 'Projects' },
    { id: '4', title: 'Nav 1', category: 'Navigation' },
  ];

  const grouped = groupCommandsByCategory(mixed);
  assert.equal(grouped.length, 4);
  assert.equal(grouped[0].category, 'Actions');
  assert.equal(grouped[1].category, 'Navigation');
  assert.equal(grouped[2].category, 'Projects');
  assert.equal(grouped[3].category, 'Tasks');
});

test('getNextSelectableIndex: keyboard arrow navigation handles wraparound safely', () => {
  const total = 5;

  // Move down from 0 to 1
  assert.equal(getNextSelectableIndex(0, 1, total), 1);
  // Move down from 4 to 0 (wraparound)
  assert.equal(getNextSelectableIndex(4, 1, total), 0);
  // Move up from 1 to 0
  assert.equal(getNextSelectableIndex(1, -1, total), 0);
  // Move up from 0 to 4 (wraparound)
  assert.equal(getNextSelectableIndex(0, -1, total), 4);

  // Edge case: total 0
  assert.equal(getNextSelectableIndex(0, 1, 0), 0);
});
