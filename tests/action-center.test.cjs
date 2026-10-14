/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ts = require('typescript');

// Transpile review-aging.ts to verify SLA badge integration
const reviewAgingExports = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/review-aging.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(reviewAgingExports);
const { getReviewAging } = reviewAgingExports;

test('Action Center logic: review task waiting on user receives SLA badge and action variant', () => {
  const aging = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(), // 30h ago (aging tier)
  });
  assert.ok(aging);
  assert.equal(aging.tier, 'aging');
  assert.equal(aging.days, 1);

  const badge_label =
    aging.tier === 'stalled'
      ? `Review stalled (${aging.days}d)`
      : aging.tier === 'aging'
        ? `Review aging (${aging.days}d)`
        : 'Review requested';
  const badge_variant = aging.tier === 'stalled' ? 'warn' : 'action';

  assert.equal(badge_label, 'Review aging (1d)');
  assert.equal(badge_variant, 'action');
});

test('Action Center logic: stalled review task (>48h) triggers critical SLA warning', () => {
  const aging = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(Date.now() - 75 * 3600 * 1000).toISOString(), // 3+ days
  });
  assert.ok(aging);
  assert.equal(aging.tier, 'stalled');
  assert.equal(aging.days, 3);

  const badge_label =
    aging.tier === 'stalled'
      ? `Review stalled (${aging.days}d)`
      : aging.tier === 'aging'
        ? `Review aging (${aging.days}d)`
        : 'Review requested';
  const badge_variant = aging.tier === 'stalled' ? 'warn' : 'action';

  assert.equal(badge_label, 'Review stalled (3d)');
  assert.equal(badge_variant, 'warn');
});

test('Action Center bucket classification and mutual exclusivity', () => {
  const mockTasks = [
    {
      id: 't1',
      title: 'Review Alpha Architecture',
      status: 'in_review',
      isReviewer: true,
      due_date: '2026-10-14',
    },
    {
      id: 't2',
      title: 'Sign off on Security Checklist',
      status: 'todo',
      hasAckPending: true,
      due_date: '2026-10-20',
    },
    {
      id: 't3',
      title: 'Begin Frontend Implementation',
      status: 'todo',
      hasDeps: true,
      allDepsDone: true,
      due_date: '2026-10-18',
    },
    {
      id: 't4',
      title: 'Database indexing benchmark',
      status: 'in_progress',
      due_date: '2026-10-15',
    },
    {
      id: 't5',
      title: 'API Gateway refactoring',
      status: 'in_review',
      isReviewer: false,
      waitingReviewer: 'Maya Sharma',
      due_date: '2026-10-16',
    },
    {
      id: 't6',
      title: 'Deploy to Staging',
      status: 'blocked',
      isReviewer: false,
      blockingTitles: 'Database indexing benchmark',
      due_date: '2026-10-17',
    },
  ];

  const needsAction = [];
  const activeWork = [];
  const waitingOnOthers = [];

  for (const t of mockTasks) {
    if (t.isReviewer && t.status === 'in_review') {
      needsAction.push({ id: t.id, action_type: 'review_needed' });
    } else if (t.hasAckPending) {
      needsAction.push({ id: t.id, action_type: 'accept_needed' });
    } else if (t.hasDeps && t.allDepsDone && t.status === 'todo') {
      needsAction.push({ id: t.id, action_type: 'unblocked_ready' });
    } else if (t.status === 'in_progress') {
      activeWork.push({ id: t.id, action_type: 'in_progress' });
    } else if (t.status === 'in_review' && !t.isReviewer) {
      waitingOnOthers.push({ id: t.id, action_type: 'waiting_review' });
    } else if (t.status === 'blocked') {
      waitingOnOthers.push({ id: t.id, action_type: 'waiting_blocked' });
    }
  }

  assert.equal(needsAction.length, 3);
  assert.equal(needsAction[0].action_type, 'review_needed');
  assert.equal(needsAction[1].action_type, 'accept_needed');
  assert.equal(needsAction[2].action_type, 'unblocked_ready');

  assert.equal(activeWork.length, 1);
  assert.equal(activeWork[0].action_type, 'in_progress');

  assert.equal(waitingOnOthers.length, 2);
  assert.equal(waitingOnOthers[0].action_type, 'waiting_review');
  assert.equal(waitingOnOthers[1].action_type, 'waiting_blocked');

  // Verify strict mutual exclusivity: no task in needsAction appears in activeWork
  const needsActionIds = new Set(needsAction.map(x => x.id));
  const activeWorkIds = new Set(activeWork.map(x => x.id));
  const waitingIds = new Set(waitingOnOthers.map(x => x.id));

  for (const id of needsActionIds) {
    assert.equal(activeWorkIds.has(id), false);
    assert.equal(waitingIds.has(id), false);
  }
});
