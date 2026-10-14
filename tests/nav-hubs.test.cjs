/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ts = require('typescript');

// Transpile nav-hubs.ts to CommonJS for testing
const navExports = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/nav-hubs.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(navExports);

const { NAV_HUBS, getNavHubs, isHubActive, isHubItemActive } = navExports;

test('NAV_HUBS defines exactly 4 primary desktop navigation hubs', () => {
  assert.equal(NAV_HUBS.length, 4);
  const hubIds = NAV_HUBS.map(h => h.id);
  assert.deepEqual(hubIds, ['hub-work', 'hub-projects', 'hub-planning', 'hub-insights']);
});

test('getNavHubs: non-admin filters out admin-only items (workload, admin/users)', () => {
  const hubs = getNavHubs(false);
  const planningHub = hubs.find(h => h.id === 'hub-planning');
  assert.ok(planningHub);
  assert.equal(planningHub.items.some(i => i.href === '/dashboard/workload'), false);

  const insightsHub = hubs.find(h => h.id === 'hub-insights');
  assert.ok(insightsHub);
  assert.equal(insightsHub.items.some(i => i.href === '/admin/users'), false);
});

test('getNavHubs: admin includes all admin-only items', () => {
  const hubs = getNavHubs(true);
  const planningHub = hubs.find(h => h.id === 'hub-planning');
  assert.ok(planningHub);
  assert.equal(planningHub.items.some(i => i.href === '/dashboard/workload'), true);

  const insightsHub = hubs.find(h => h.id === 'hub-insights');
  assert.ok(insightsHub);
  assert.equal(insightsHub.items.some(i => i.href === '/admin/users'), true);
});

test('isHubActive: Work hub is active on Focus, My Tasks, and All Tasks', () => {
  const workHub = NAV_HUBS.find(h => h.id === 'hub-work');
  assert.equal(isHubActive(workHub, '/dashboard'), true);
  assert.equal(isHubActive(workHub, '/dashboard/my-tasks'), true);
  assert.equal(isHubActive(workHub, '/dashboard/tasks'), true);
  assert.equal(isHubActive(workHub, '/dashboard/calendar'), false);
  assert.equal(isHubActive(workHub, '/dashboard/reports'), false);
});

test('isHubActive: Projects hub is active on project pages, templates, and archive', () => {
  const projHub = NAV_HUBS.find(h => h.id === 'hub-projects');
  assert.equal(isHubActive(projHub, '/dashboard/projects/123-abc'), true);
  assert.equal(isHubActive(projHub, '/dashboard/templates'), true);
  assert.equal(isHubActive(projHub, '/dashboard/archive'), true);
  assert.equal(isHubActive(projHub, '/dashboard/insights'), false);
});

test('isHubActive: Planning hub is active on Calendar and Workload', () => {
  const planHub = NAV_HUBS.find(h => h.id === 'hub-planning');
  assert.equal(isHubActive(planHub, '/dashboard/calendar'), true);
  assert.equal(isHubActive(planHub, '/dashboard/workload'), true);
  assert.equal(isHubActive(planHub, '/dashboard/tasks'), false);
});

test('isHubActive: Insights hub is active on Insights, Reports, History, and Admin Users', () => {
  const insightsHub = NAV_HUBS.find(h => h.id === 'hub-insights');
  assert.equal(isHubActive(insightsHub, '/dashboard/insights'), true);
  assert.equal(isHubActive(insightsHub, '/dashboard/reports'), true);
  assert.equal(isHubActive(insightsHub, '/dashboard/history'), true);
  assert.equal(isHubActive(insightsHub, '/admin/users'), true);
  assert.equal(isHubActive(insightsHub, '/dashboard/my-tasks'), false);
});

test('isHubItemActive: handles exact, prefix and sub-route paths correctly', () => {
  assert.equal(isHubItemActive('/dashboard/tasks', '/dashboard/tasks'), true);
  assert.equal(isHubItemActive('/dashboard/tasks', '/dashboard/tasks?status=in_review'), true);
  assert.equal(isHubItemActive('/dashboard/tasks', '/dashboard/tasks/details'), true);
  assert.equal(isHubItemActive('/dashboard/tasks', '/dashboard'), false);
});
