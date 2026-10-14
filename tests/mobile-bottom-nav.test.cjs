/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ts = require('typescript');

// Transpile mobile-nav.ts to CommonJS for testing
const navExports = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/mobile-nav.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(navExports);

const { MOBILE_NAV_ITEMS, isMobileNavActive, formatUnreadBadge } = navExports;

test('Mobile bottom nav contains exactly 5 primary mobile destinations', () => {
  assert.equal(MOBILE_NAV_ITEMS.length, 5);
  const ids = MOBILE_NAV_ITEMS.map(i => i.id);
  assert.deepEqual(ids, [
    'mobile-nav-focus',
    'mobile-nav-my-tasks',
    'mobile-nav-projects',
    'mobile-nav-inbox',
    'mobile-nav-jump',
  ]);
});

test('Mobile nav active resolution: Focus is active only on /dashboard', () => {
  assert.equal(isMobileNavActive('/dashboard', '/dashboard'), true);
  assert.equal(isMobileNavActive('/dashboard', '/dashboard/my-tasks'), false);
  assert.equal(isMobileNavActive('/dashboard', '/dashboard/projects/123'), false);
  assert.equal(isMobileNavActive('/dashboard', '/dashboard/notifications'), false);
});

test('Mobile nav active resolution: My Tasks is active on /dashboard/my-tasks', () => {
  assert.equal(isMobileNavActive('/dashboard/my-tasks', '/dashboard/my-tasks'), true);
  assert.equal(isMobileNavActive('/dashboard/my-tasks', '/dashboard'), false);
});

test('Mobile nav active resolution: Projects is active on project detail routes', () => {
  assert.equal(isMobileNavActive('/dashboard#projects', '/dashboard/projects/123-abc'), true);
  assert.equal(isMobileNavActive('/dashboard#projects', '/dashboard'), false);
});

test('Mobile nav active resolution: Inbox is active on /dashboard/notifications', () => {
  assert.equal(isMobileNavActive('/dashboard/notifications', '/dashboard/notifications'), true);
  assert.equal(isMobileNavActive('/dashboard/notifications', '/dashboard/notifications/archived'), true);
  assert.equal(isMobileNavActive('/dashboard/notifications', '/dashboard'), false);
});

test('Mobile nav active resolution: Action button (Jump) has no active route', () => {
  assert.equal(isMobileNavActive(undefined, '/dashboard'), false);
});

test('formatUnreadBadge: 0 or negative returns null', () => {
  assert.equal(formatUnreadBadge(0), null);
  assert.equal(formatUnreadBadge(-1), null);
});

test('formatUnreadBadge: 1 to 9 returns exact string count', () => {
  assert.equal(formatUnreadBadge(1), '1');
  assert.equal(formatUnreadBadge(5), '5');
  assert.equal(formatUnreadBadge(9), '9');
});

test('formatUnreadBadge: > 9 caps cleanly at 9+', () => {
  assert.equal(formatUnreadBadge(10), '9+');
  assert.equal(formatUnreadBadge(99), '9+');
});
