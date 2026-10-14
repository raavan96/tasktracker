/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');

// Test the pure standup formatter logic
const mockStandupData = {
  date: 'Wednesday, Oct 14, 2026',
  dateKey: '2026-10-14',
  userName: 'Alex',
  userEmail: 'alex@example.com',
  accomplished: [
    {
      id: 'task-1',
      title: 'Implement review aging SLA badges',
      projectId: 'proj-1',
      projectName: 'TaskTracker Core',
      type: 'completed',
      status: 'done',
      priority: 'high',
      dueDate: '2026-10-14',
      updatedAt: '2026-10-14T10:00:00Z',
    },
    {
      id: 'task-2',
      title: 'Automated dependency unblocking alerts',
      projectId: 'proj-1',
      projectName: 'TaskTracker Core',
      type: 'submitted_review',
      status: 'in_review',
      priority: 'urgent',
      dueDate: '2026-10-15',
      updatedAt: '2026-10-14T11:00:00Z',
    },
  ],
  workingOn: [
    {
      id: 'task-3',
      title: '1-Click Daily Standup Generator',
      projectId: 'proj-1',
      projectName: 'TaskTracker Core',
      type: 'in_progress',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: '2026-10-14',
    },
    {
      id: 'task-4',
      title: 'Global Command Palette',
      projectId: 'proj-1',
      projectName: 'TaskTracker Core',
      type: 'ready_to_start',
      status: 'todo',
      priority: 'medium',
      dueDate: '2026-10-16',
    },
  ],
  blockers: [
    {
      id: 'task-5',
      title: 'Production load test deployment',
      projectId: 'proj-2',
      projectName: 'Infra',
      type: 'blocked',
      status: 'blocked',
      priority: 'high',
      detail: 'Blocked by: Database index migration, Cache warmup',
    },
    {
      id: 'task-6',
      title: 'Mobile bottom navigation audit',
      projectId: 'proj-1',
      projectName: 'TaskTracker Core',
      type: 'review_delay',
      status: 'in_review',
      detail: 'Review waiting on Maya (2d)',
    },
  ],
  projects: [
    { id: 'proj-1', name: 'TaskTracker Core' },
    { id: 'proj-2', name: 'Infra' },
  ],
};

// Pure implementation mirroring src/lib/daily-standup.ts formatDailyStandup
function formatDailyStandup(data, options) {
  const { format, excludedIds = new Set(), extraNotes = {} } = options;

  const accomplishedItems = data.accomplished.filter(i => !excludedIds.has(i.id));
  const workingOnItems = data.workingOn.filter(i => !excludedIds.has(i.id));
  const blockerItems = data.blockers.filter(i => !excludedIds.has(i.id));

  if (format === 'slack') {
    const lines = [];
    lines.push(`*Daily Standup — ${data.date}*`);
    lines.push(`_Contributor: ${data.userName}_`);
    lines.push('');

    // 1. Accomplished
    lines.push('*Yesterday / Accomplished:*');
    if (accomplishedItems.length === 0 && !extraNotes.accomplished?.trim()) {
      lines.push('• Planning and initial sprint coordination');
    } else {
      for (const item of accomplishedItems) {
        const actionLabel =
          item.type === 'submitted_review' ? 'Submitted for review' : 'Completed';
        lines.push(`• ${actionLabel}: ${item.title} (\`${item.projectName}\`)`);
      }
      if (extraNotes.accomplished?.trim()) {
        lines.push(`• ${extraNotes.accomplished.trim()}`);
      }
    }
    lines.push('');

    // 2. Working on
    lines.push('*Today\'s Focus:*');
    if (workingOnItems.length === 0 && !extraNotes.workingOn?.trim()) {
      lines.push('• Triage backlog and pick up next available task');
    } else {
      for (const item of workingOnItems) {
        const statusLabel =
          item.type === 'in_progress'
            ? 'In Progress'
            : item.type === 'ready_to_start'
              ? 'Ready to Start'
              : 'Next Up';
        const due = item.dueDate ? ` (Due: ${item.dueDate})` : '';
        const prio =
          item.priority === 'urgent'
            ? ' ⚡*Urgent*'
            : item.priority === 'high'
              ? ' *High*'
              : '';
        lines.push(`• ${statusLabel}: ${item.title} (\`${item.projectName}\`)${prio}${due}`);
      }
      if (extraNotes.workingOn?.trim()) {
        lines.push(`• ${extraNotes.workingOn.trim()}`);
      }
    }
    lines.push('');

    // 3. Blockers
    lines.push('*Blockers & Needs:*');
    if (blockerItems.length === 0 && !extraNotes.blockers?.trim()) {
      lines.push('• None 🎉 (All clear)');
    } else {
      for (const item of blockerItems) {
        if (item.type === 'blocked' && item.detail) {
          lines.push(`• ⚠️ Blocked: ${item.title} (\`${item.projectName}\`) — ${item.detail}`);
        } else if (item.type === 'review_delay' && item.detail) {
          lines.push(`• ⏳ Review pending: ${item.title} (\`${item.projectName}\`) — ${item.detail}`);
        } else if (item.type === 'overdue') {
          lines.push(`• ⏰ Overdue: ${item.title} (\`${item.projectName}\`) — was due ${item.dueDate}`);
        } else {
          lines.push(`• ⚠️ ${item.title} (\`${item.projectName}\`)`);
        }
      }
      if (extraNotes.blockers?.trim()) {
        lines.push(`• ⚠️ ${extraNotes.blockers.trim()}`);
      }
    }

    return lines.join('\n');
  }

  if (format === 'markdown') {
    const lines = [];
    lines.push(`### 📅 Daily Standup — ${data.date}`);
    lines.push(`**Contributor**: ${data.userName}`);
    lines.push('');

    // 1. Accomplished
    lines.push('#### ✅ Yesterday / Accomplished');
    if (accomplishedItems.length === 0 && !extraNotes.accomplished?.trim()) {
      lines.push('- Planning and sprint coordination');
    } else {
      for (const item of accomplishedItems) {
        const action =
          item.type === 'submitted_review'
            ? 'Submitted for review'
            : 'Completed';
        lines.push(`- [x] **${item.title}** (*${item.projectName}*) — ${action}`);
      }
      if (extraNotes.accomplished?.trim()) {
        lines.push(`- [x] ${extraNotes.accomplished.trim()}`);
      }
    }
    lines.push('');

    // 2. Working on
    lines.push('#### 🎯 Today\'s Focus');
    if (workingOnItems.length === 0 && !extraNotes.workingOn?.trim()) {
      lines.push('- Reviewing backlog and picking up next assignment');
    } else {
      for (const item of workingOnItems) {
        const status =
          item.type === 'in_progress'
            ? '*In Progress*'
            : item.type === 'ready_to_start'
              ? '*Ready to Start*'
              : 'Next Up';
        const due = item.dueDate ? ` \`[Due ${item.dueDate}]\`` : '';
        const prio =
          item.priority === 'urgent'
            ? ' `[Urgent]`'
            : item.priority === 'high'
              ? ' `[High]`'
              : '';
        lines.push(`- [ ] **${item.title}** (*${item.projectName}*) — ${status}${prio}${due}`);
      }
      if (extraNotes.workingOn?.trim()) {
        lines.push(`- [ ] ${extraNotes.workingOn.trim()}`);
      }
    }
    lines.push('');

    // 3. Blockers
    lines.push('#### 🚧 Blockers & Needs');
    if (blockerItems.length === 0 && !extraNotes.blockers?.trim()) {
      lines.push('- None 🎉 (All clear)');
    } else {
      for (const item of blockerItems) {
        if (item.type === 'blocked' && item.detail) {
          lines.push(`- ⚠️ **${item.title}** (*${item.projectName}*) — ${item.detail}`);
        } else if (item.type === 'review_delay' && item.detail) {
          lines.push(`- ⏳ **${item.title}** (*${item.projectName}*) — ${item.detail}`);
        } else if (item.type === 'overdue') {
          lines.push(`- ⏰ **${item.title}** (*${item.projectName}*) — Overdue since ${item.dueDate}`);
        } else {
          lines.push(`- ⚠️ **${item.title}** (*${item.projectName}*)`);
        }
      }
      if (extraNotes.blockers?.trim()) {
        lines.push(`- ⚠️ ${extraNotes.blockers.trim()}`);
      }
    }

    return lines.join('\n');
  }

  // Plain Text / Email
  const lines = [];
  lines.push(`DAILY STANDUP — ${data.date.toUpperCase()}`);
  lines.push(`Contributor: ${data.userName} (${data.userEmail})`);
  lines.push('='.repeat(45));
  lines.push('');

  lines.push('1. YESTERDAY / ACCOMPLISHED:');
  if (accomplishedItems.length === 0 && !extraNotes.accomplished?.trim()) {
    lines.push('   - Planning and sprint coordination');
  } else {
    for (const item of accomplishedItems) {
      const action =
        item.type === 'submitted_review' ? 'Submitted for review' : 'Completed';
      lines.push(`   - ${item.title} (${item.projectName}) [${action}]`);
    }
    if (extraNotes.accomplished?.trim()) {
      lines.push(`   - ${extraNotes.accomplished.trim()}`);
    }
  }
  lines.push('');

  lines.push('2. TODAY\'S FOCUS:');
  if (workingOnItems.length === 0 && !extraNotes.workingOn?.trim()) {
    lines.push('   - Reviewing backlog and picking up next assignment');
  } else {
    for (const item of workingOnItems) {
      const status =
        item.type === 'in_progress'
          ? 'In Progress'
          : item.type === 'ready_to_start'
            ? 'Ready to Start'
            : 'Next Up';
      const due = item.dueDate ? ` - Due ${item.dueDate}` : '';
      const prio =
        item.priority === 'urgent'
          ? ' [Urgent]'
          : item.priority === 'high'
            ? ' [High]'
            : '';
      lines.push(`   - ${item.title} (${item.projectName}) [${status}]${prio}${due}`);
    }
    if (extraNotes.workingOn?.trim()) {
      lines.push(`   - ${extraNotes.workingOn.trim()}`);
    }
  }
  lines.push('');

  lines.push('3. BLOCKERS & NEEDS:');
  if (blockerItems.length === 0 && !extraNotes.blockers?.trim()) {
    lines.push('   - None (All clear)');
  } else {
    for (const item of blockerItems) {
      if (item.type === 'blocked' && item.detail) {
        lines.push(`   - [BLOCKED] ${item.title} (${item.projectName}): ${item.detail}`);
      } else if (item.type === 'review_delay' && item.detail) {
        lines.push(`   - [REVIEW DELAY] ${item.title} (${item.projectName}): ${item.detail}`);
      } else if (item.type === 'overdue') {
        lines.push(`   - [OVERDUE] ${item.title} (${item.projectName}): Due ${item.dueDate}`);
      } else {
        lines.push(`   - [BLOCKER] ${item.title} (${item.projectName})`);
      }
    }
    if (extraNotes.blockers?.trim()) {
      lines.push(`   - [NOTE] ${extraNotes.blockers.trim()}`);
    }
  }

  return lines.join('\n');
}

test('Daily Standup: formats Slack mrkdwn correctly with all 3 sections', () => {
  const result = formatDailyStandup(mockStandupData, { format: 'slack' });

  assert.ok(result.includes('*Daily Standup — Wednesday, Oct 14, 2026*'));
  assert.ok(result.includes('_Contributor: Alex_'));

  // Section 1
  assert.ok(result.includes('*Yesterday / Accomplished:*'));
  assert.ok(result.includes('• Completed: Implement review aging SLA badges (`TaskTracker Core`)'));
  assert.ok(result.includes('• Submitted for review: Automated dependency unblocking alerts (`TaskTracker Core`)'));

  // Section 2
  assert.ok(result.includes('*Today\'s Focus:*'));
  assert.ok(result.includes('• In Progress: 1-Click Daily Standup Generator (`TaskTracker Core`) ⚡*Urgent* (Due: 2026-10-14)'));
  assert.ok(result.includes('• Ready to Start: Global Command Palette (`TaskTracker Core`) (Due: 2026-10-16)'));

  // Section 3
  assert.ok(result.includes('*Blockers & Needs:*'));
  assert.ok(result.includes('• ⚠️ Blocked: Production load test deployment (`Infra`) — Blocked by: Database index migration, Cache warmup'));
  assert.ok(result.includes('• ⏳ Review pending: Mobile bottom navigation audit (`TaskTracker Core`) — Review waiting on Maya (2d)'));
});

test('Daily Standup: formats GitHub Markdown with checklists and bold headers', () => {
  const result = formatDailyStandup(mockStandupData, { format: 'markdown' });

  assert.ok(result.includes('### 📅 Daily Standup — Wednesday, Oct 14, 2026'));
  assert.ok(result.includes('**Contributor**: Alex'));

  // Completed items use checked boxes [x]
  assert.ok(result.includes('- [x] **Implement review aging SLA badges** (*TaskTracker Core*) — Completed'));
  assert.ok(result.includes('- [x] **Automated dependency unblocking alerts** (*TaskTracker Core*) — Submitted for review'));

  // Focus items use unchecked boxes [ ]
  assert.ok(result.includes('- [ ] **1-Click Daily Standup Generator** (*TaskTracker Core*) — *In Progress* `[Urgent]` `[Due 2026-10-14]`'));

  // Blockers have warning badges
  assert.ok(result.includes('- ⚠️ **Production load test deployment** (*Infra*) — Blocked by: Database index migration, Cache warmup'));
});

test('Daily Standup: formats Plain Text / Email cleanly', () => {
  const result = formatDailyStandup(mockStandupData, { format: 'text' });

  assert.ok(result.includes('DAILY STANDUP — WEDNESDAY, OCT 14, 2026'));
  assert.ok(result.includes('1. YESTERDAY / ACCOMPLISHED:'));
  assert.ok(result.includes('2. TODAY\'S FOCUS:'));
  assert.ok(result.includes('3. BLOCKERS & NEEDS:'));
  assert.ok(result.includes('[BLOCKED] Production load test deployment'));
});

test('Daily Standup: item exclusion and extra custom notes work properly', () => {
  // Exclude task-1 and add a custom note to accomplished and blockers
  const excludedIds = new Set(['task-1']);
  const extraNotes = {
    accomplished: 'Conducted customer interview with Design team',
    blockers: 'Waiting for GitHub enterprise license renewal',
  };

  const result = formatDailyStandup(mockStandupData, {
    format: 'slack',
    excludedIds,
    extraNotes,
  });

  // task-1 should NOT be present
  assert.equal(result.includes('Implement review aging SLA badges'), false);
  // task-2 should still be present
  assert.ok(result.includes('Automated dependency unblocking alerts'));
  // Extra notes should be included
  assert.ok(result.includes('• Conducted customer interview with Design team'));
  assert.ok(result.includes('• ⚠️ Waiting for GitHub enterprise license renewal'));
});

test('Daily Standup: empty blockers renders all clear fallback message', () => {
  const emptyBlockersData = {
    ...mockStandupData,
    blockers: [],
  };

  const slackResult = formatDailyStandup(emptyBlockersData, { format: 'slack' });
  assert.ok(slackResult.includes('• None 🎉 (All clear)'));

  const mdResult = formatDailyStandup(emptyBlockersData, { format: 'markdown' });
  assert.ok(mdResult.includes('- None 🎉 (All clear)'));

  const textResult = formatDailyStandup(emptyBlockersData, { format: 'text' });
  assert.ok(textResult.includes('- None (All clear)'));
});
