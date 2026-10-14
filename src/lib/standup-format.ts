export type StandupItemType =
  | 'completed'
  | 'submitted_review'
  | 'in_progress'
  | 'ready_to_start'
  | 'planned'
  | 'blocked'
  | 'review_delay'
  | 'overdue';

export type StandupItem = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  type: StandupItemType;
  status: string;
  priority?: string;
  dueDate?: string | null;
  detail?: string | null;
  updatedAt?: string | null;
};

export type DailyStandupData = {
  date: string;
  dateKey: string;
  userName: string;
  userEmail: string;
  accomplished: StandupItem[];
  workingOn: StandupItem[];
  blockers: StandupItem[];
  projects: Array<{ id: string; name: string }>;
};

export type StandupFormat = 'slack' | 'markdown' | 'text';

export type StandupFormatOptions = {
  format: StandupFormat;
  excludedIds?: Set<string>;
  extraNotes?: {
    accomplished?: string;
    workingOn?: string;
    blockers?: string;
  };
};

/**
 * Pure generator creating formatted standup text from structured data.
 */
export function formatDailyStandup(
  data: DailyStandupData,
  options: StandupFormatOptions
): string {
  const { format, excludedIds = new Set<string>(), extraNotes = {} } = options;

  const accomplishedItems = data.accomplished.filter(i => !excludedIds.has(i.id));
  const workingOnItems = data.workingOn.filter(i => !excludedIds.has(i.id));
  const blockerItems = data.blockers.filter(i => !excludedIds.has(i.id));

  if (format === 'slack') {
    const lines: string[] = [];
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
    const lines: string[] = [];
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
  const lines: string[] = [];
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
