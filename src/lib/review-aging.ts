export type ReviewSlaTier = 'fresh' | 'aging' | 'stalled';

export type ReviewAgingInfo = {
  tier: ReviewSlaTier;
  hours: number;
  days: number;
  label: string;
  shortBadgeLabel: string;
  slaStatus: 'on_track' | 'aging' | 'overdue';
  isOverdueSla: boolean;
  slaDescription: string;
  reviewerName?: string;
};

export type ReviewAgingInput = {
  status: string;
  submittedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  now?: Date | number;
  reviewerName?: string | null;
};

/**
 * Computes review aging & SLA metrics for tasks in 'in_review' status.
 *
 * SLAs:
 * - Fresh (< 24h): within standard review window.
 * - Aging (24h - 48h / 1-2 days): review delay warning.
 * - Stalled (>= 48h / 3+ days): critical review bottleneck requiring attention.
 */
export function getReviewAging(input: ReviewAgingInput): ReviewAgingInfo | null {
  if (input.status !== 'in_review') {
    return null;
  }

  const nowMs = typeof input.now === 'number'
    ? input.now
    : input.now instanceof Date
    ? input.now.getTime()
    : Date.now();

  const refTime = input.submittedAt ?? input.updatedAt ?? null;
  const refMs = typeof refTime === 'string'
    ? Date.parse(refTime)
    : refTime instanceof Date
    ? refTime.getTime()
    : nowMs;

  const validRefMs = Number.isFinite(refMs) ? refMs : nowMs;
  const diffMs = Math.max(0, nowMs - validRefMs);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const reviewerSuffix = input.reviewerName?.trim() ? ` · ${input.reviewerName.trim()}` : '';

  if (hours < 24) {
    const timeLabel = hours <= 0 ? 'just now' : `${hours}h ago`;
    const shortLabel = hours <= 0 ? '<1h' : `${hours}h`;
    return {
      tier: 'fresh',
      hours,
      days,
      label: `In review · ${timeLabel}`,
      shortBadgeLabel: shortLabel,
      slaStatus: 'on_track',
      isOverdueSla: false,
      slaDescription: hours <= 0 ? 'Submitted just now (within 24h SLA)' : `Submitted ${hours}h ago (within 24h SLA)`,
      reviewerName: input.reviewerName ?? undefined,
    };
  }

  if (hours < 48) {
    const displayDays = Math.max(1, days);
    return {
      tier: 'aging',
      hours,
      days: displayDays,
      label: `Waiting ${displayDays}d${reviewerSuffix}`,
      shortBadgeLabel: `Waiting ${displayDays}d`,
      slaStatus: 'aging',
      isOverdueSla: false,
      slaDescription: `Submitted ${displayDays}d ago (${hours}h elapsed · approaching SLA limit)`,
      reviewerName: input.reviewerName ?? undefined,
    };
  }

  const displayDays = Math.max(2, days);
  return {
    tier: 'stalled',
    hours,
    days: displayDays,
    label: `Stalled · ${displayDays}d${reviewerSuffix}`,
    shortBadgeLabel: `Stalled · ${displayDays}d`,
    slaStatus: 'overdue',
    isOverdueSla: true,
    slaDescription: `Submitted ${displayDays}d ago (${hours}h elapsed · overdue >48h SLA)`,
    reviewerName: input.reviewerName ?? undefined,
  };
}

/**
 * Determines eligible reviewer name based on workspace review policies.
 */
export function getEligibleReviewer(
  task: {
    creator?: { full_name?: string | null; email?: string | null; role?: string; is_active?: boolean } | null;
    created_by?: string | null;
    assignee_ids?: string[] | null;
    assignee_id?: string | null;
  },
  options?: { reviewEnabled?: boolean; isAdmin?: boolean }
): { name: string; isCreator: boolean } {
  const reviewEnabled = options?.reviewEnabled ?? false;
  const ids = task.assignee_ids ?? (task.assignee_id ? [task.assignee_id] : []);
  const creator = task.creator;
  const creatorId = task.created_by;

  const creatorEligible = creator?.is_active !== false && (
    creator?.role === 'admin' || (reviewEnabled && Boolean(creatorId) && !ids.includes(creatorId as string))
  );

  if (creatorEligible && (creator?.full_name || creator?.email)) {
    const rawName = creator.full_name?.trim() || creator.email?.split('@')[0] || 'Creator';
    const firstName = rawName.split(/\s+/)[0] || rawName;
    return { name: firstName, isCreator: true };
  }

  return { name: 'Admin', isCreator: false };
}
