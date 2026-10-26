/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ts = require('typescript');

const exportsUnderTest = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/review-aging.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(exportsUnderTest);

const { getReviewAging, getEligibleReviewer } = exportsUnderTest;

test('Review Aging: non-review statuses return null', () => {
  for (const status of ['todo', 'in_progress', 'blocked', 'done']) {
    assert.equal(getReviewAging({ status, updatedAt: new Date() }), null);
  }
});

test('Review Aging: Fresh tier (<24h) reports elapsed time without a configured SLA', () => {
  const base = new Date('2026-10-14T12:00:00Z').getTime();

  // Just now
  const justNow = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base),
    now: base,
  });
  assert.equal(justNow.tier, 'fresh');
  assert.equal(justNow.hours, 0);
  assert.equal(justNow.days, 0);
  assert.equal(justNow.label, 'In review · just now');
  assert.equal(justNow.shortBadgeLabel, '<1h');
  assert.equal(justNow.isOverdueSla, false);
  assert.equal(justNow.slaStatus, 'not_configured');

  // 3 hours ago
  const threeHours = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 3 * 3600 * 1000),
    now: base,
  });
  assert.equal(threeHours.tier, 'fresh');
  assert.equal(threeHours.hours, 3);
  assert.equal(threeHours.label, 'In review · 3h ago');
  assert.equal(threeHours.shortBadgeLabel, '3h');
  assert.equal(threeHours.isOverdueSla, false);

  // 23 hours ago (still fresh)
  const twentyThreeHours = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 23 * 3600 * 1000),
    now: base,
  });
  assert.equal(twentyThreeHours.tier, 'fresh');
  assert.equal(twentyThreeHours.hours, 23);
  assert.equal(twentyThreeHours.isOverdueSla, false);
});

test('Review Aging: Aging tier (24h to 48h) includes reviewer target and elapsed time', () => {
  const base = new Date('2026-10-14T12:00:00Z').getTime();

  // Exactly 24 hours
  const oneDay = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 24 * 3600 * 1000),
    now: base,
    reviewerName: 'Maya',
  });
  assert.equal(oneDay.tier, 'aging');
  assert.equal(oneDay.hours, 24);
  assert.equal(oneDay.days, 1);
  assert.equal(oneDay.label, 'Waiting 1d · Maya');
  assert.equal(oneDay.shortBadgeLabel, 'Waiting 1d');
  assert.equal(oneDay.isOverdueSla, false);
  assert.equal(oneDay.slaStatus, 'not_configured');

  // 36 hours without reviewer name
  const thirtySixHours = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 36 * 3600 * 1000),
    now: base,
  });
  assert.equal(thirtySixHours.tier, 'aging');
  assert.equal(thirtySixHours.days, 1);
  assert.equal(thirtySixHours.label, 'Waiting 1d');
  assert.equal(thirtySixHours.shortBadgeLabel, 'Waiting 1d');

  // 47 hours
  const fortySevenHours = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 47 * 3600 * 1000),
    now: base,
    reviewerName: 'Admin',
  });
  assert.equal(fortySevenHours.tier, 'aging');
  assert.equal(fortySevenHours.days, 1);
  assert.equal(fortySevenHours.label, 'Waiting 1d · Admin');
});

test('Review Aging: Stalled tier (>=48h) does not invent an overdue SLA', () => {
  const base = new Date('2026-10-14T12:00:00Z').getTime();

  // Exactly 48 hours (2 days)
  const twoDays = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 48 * 3600 * 1000),
    now: base,
    reviewerName: 'Maya',
  });
  assert.equal(twoDays.tier, 'stalled');
  assert.equal(twoDays.hours, 48);
  assert.equal(twoDays.days, 2);
  assert.equal(twoDays.label, 'Waiting 2d · Maya');
  assert.equal(twoDays.shortBadgeLabel, 'Waiting 2d');
  assert.equal(twoDays.isOverdueSla, false);
  assert.equal(twoDays.slaStatus, 'not_configured');

  // 72 hours (3 days)
  const threeDays = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 72 * 3600 * 1000),
    now: base,
    reviewerName: 'Maya',
  });
  assert.equal(threeDays.tier, 'stalled');
  assert.equal(threeDays.days, 3);
  assert.equal(threeDays.label, 'Waiting 3d · Maya');
  assert.equal(threeDays.shortBadgeLabel, 'Waiting 3d');

  // 7 days
  const sevenDays = getReviewAging({
    status: 'in_review',
    updatedAt: new Date(base - 7 * 24 * 3600 * 1000),
    now: base,
  });
  assert.equal(sevenDays.tier, 'stalled');
  assert.equal(sevenDays.days, 7);
  assert.equal(sevenDays.label, 'Waiting 7d');
  assert.equal(sevenDays.isOverdueSla, false);
});

test('Review Aging: submittedAt takes precedence over updatedAt', () => {
  const base = new Date('2026-10-14T12:00:00Z').getTime();
  const aging = getReviewAging({
    status: 'in_review',
    submittedAt: new Date(base - 50 * 3600 * 1000), // 50h ago
    updatedAt: new Date(base - 1 * 3600 * 1000),    // 1h ago
    now: base,
  });
  assert.equal(aging.tier, 'stalled');
  assert.equal(aging.hours, 50);
});

test('Review Aging: eligible reviewer resolution', () => {
  // Case 1: Creator is active admin -> creator eligible
  const adminCreator = getEligibleReviewer({
    creator: { full_name: 'Maya Sharma', role: 'admin', is_active: true },
    created_by: 'user-1',
    assignee_ids: ['user-2'],
  }, { reviewEnabled: false });
  assert.equal(adminCreator.name, 'Maya');
  assert.equal(adminCreator.isCreator, true);

  // Case 2: Creator is active member with reviewEnabled and not assigned -> creator eligible
  const memberCreator = getEligibleReviewer({
    creator: { full_name: 'Arjun Verma', role: 'member', is_active: true },
    created_by: 'user-3',
    assignee_ids: ['user-4'],
  }, { reviewEnabled: true });
  assert.equal(memberCreator.name, 'Arjun');
  assert.equal(memberCreator.isCreator, true);

  // Case 3: Creator is assigned to the task (member) -> self-review not allowed, falls back to Admin
  const selfAssignedCreator = getEligibleReviewer({
    creator: { full_name: 'Arjun Verma', role: 'member', is_active: true },
    created_by: 'user-3',
    assignee_ids: ['user-3', 'user-4'],
  }, { reviewEnabled: true });
  assert.equal(selfAssignedCreator.name, 'Admin');
  assert.equal(selfAssignedCreator.isCreator, false);

  // Case 4: Inactive creator -> falls back to Admin
  const inactiveCreator = getEligibleReviewer({
    creator: { full_name: 'Maya Sharma', role: 'admin', is_active: false },
    created_by: 'user-1',
    assignee_ids: ['user-2'],
  });
  assert.equal(inactiveCreator.name, 'Admin');
  assert.equal(inactiveCreator.isCreator, false);
});
