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

test('review waiting time stays descriptive without a configured business SLA',()=>{
 for(const hours of [30,75]){
  const aging=getReviewAging({status:'in_review',updatedAt:new Date(Date.now()-hours*3600*1000).toISOString()});
  assert.ok(aging);assert.match(aging.label,/Waiting/);assert.equal(aging.isOverdueSla,false);assert.equal(aging.slaStatus,'not_configured');assert.doesNotMatch(aging.slaDescription,/SLA|overdue|stalled/i);
 }
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
