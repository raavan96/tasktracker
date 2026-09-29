/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ts = require('typescript');

const exportsUnderTest = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/notification-resolution.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(exportsUnderTest);

const { getNotificationResolution } = exportsUnderTest;

test('UX-10: Ready for review notification on approved task is resolved as Already completed', () => {
  const staleReviewNotice = {
    id: 'n1',
    title: 'Ready for review',
    message: 'Feature launch checklist',
    created_at: '2026-09-28T10:00:00Z',
    is_read: false,
    task: {
      id: 't1',
      project_id: 'p1',
      title: 'Feature launch checklist',
      status: 'done',
      is_archived: false,
      project_name: 'Central Operations',
    },
    actor_name: 'Maya Sharma',
  };

  const resolution = getNotificationResolution(staleReviewNotice);
  assert.equal(resolution.badge, 'Already completed');
  assert.equal(resolution.variant, 'success');
  assert.equal(resolution.isStaleAction, true);
  assert.match(resolution.explanation, /already been completed and approved/i);
});

test('UX-10: Ready for review notification on active task shows Action needed', () => {
  const activeReviewNotice = {
    id: 'n2',
    title: 'Ready for review',
    message: 'Audit findings',
    created_at: '2026-09-29T08:00:00Z',
    is_read: false,
    task: {
      id: 't2',
      project_id: 'p1',
      title: 'Audit findings',
      status: 'in_review',
      is_archived: false,
      project_name: 'Central Operations',
    },
    actor_name: 'Arjun Verma',
  };

  const resolution = getNotificationResolution(activeReviewNotice);
  assert.equal(resolution.badge, 'Action needed');
  assert.equal(resolution.variant, 'action');
  assert.equal(resolution.isStaleAction, false);
});

test('UX-10: Ready for review notification when review was withdrawn or reopened', () => {
  const withdrawnNotice = {
    id: 'n3',
    title: 'Ready for review',
    message: 'Data migration',
    created_at: '2026-09-27T08:00:00Z',
    is_read: true,
    task: {
      id: 't3',
      project_id: 'p1',
      title: 'Data migration',
      status: 'in_progress',
      is_archived: false,
      project_name: 'Central Operations',
    },
  };

  const resolution = getNotificationResolution(withdrawnNotice);
  assert.equal(resolution.badge, 'Review withdrawn');
  assert.equal(resolution.variant, 'muted');
  assert.equal(resolution.isStaleAction, true);
  assert.match(resolution.explanation, /no longer pending/i);
});

test('UX-10: Task assignment shows Already completed if task finished, Assigned if active', () => {
  const finishedAssignment = {
    id: 'n4',
    title: 'Task assigned',
    message: 'Create index',
    created_at: '2026-09-20T08:00:00Z',
    is_read: true,
    task: {
      id: 't4',
      project_id: 'p1',
      status: 'done',
      is_archived: false,
    },
  };
  assert.equal(getNotificationResolution(finishedAssignment).badge, 'Already completed');

  const openAssignment = {
    id: 'n5',
    title: 'Task assigned',
    message: 'Create index',
    created_at: '2026-09-29T08:00:00Z',
    is_read: false,
    task: {
      id: 't5',
      project_id: 'p1',
      status: 'todo',
      is_archived: false,
    },
  };
  const res = getNotificationResolution(openAssignment);
  assert.equal(res.badge, 'Assigned');
  assert.equal(res.variant, 'action');
});

test('UX-10: Deadline notice on completed task shows Already completed', () => {
  const deadlineNotice = {
    id: 'n6',
    title: 'Due today',
    message: 'Submit budget',
    created_at: '2026-09-25T08:00:00Z',
    is_read: false,
    task: {
      id: 't6',
      project_id: 'p1',
      status: 'done',
      is_archived: false,
    },
  };
  assert.equal(getNotificationResolution(deadlineNotice).badge, 'Already completed');
});

test('UX-10: Mentions and chat notices are correctly resolved', () => {
  const mentionNotice = {
    id: 'n7',
    title: 'You were mentioned',
    message: 'Can you check this?',
    dedupe_key: 'mention:c1:u1',
    created_at: '2026-09-29T09:00:00Z',
    is_read: false,
    task: { id: 't7', project_id: 'p1', status: 'in_progress' },
  };
  assert.equal(getNotificationResolution(mentionNotice).badge, 'Mention');

  const chatNotice = {
    id: 'n8',
    title: 'Chat mention',
    message: 'Hello team',
    created_at: '2026-09-29T09:00:00Z',
    is_read: false,
  };
  assert.equal(getNotificationResolution(chatNotice).badge, 'Chat mention');
});
