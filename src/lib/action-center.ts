import 'server-only';
import { workspaceRead } from './workspace-data';
import { todayKey } from './task-presentation';
import { getReviewAging } from './review-aging';

export type ActionType =
  | 'review_needed'
  | 'accept_needed'
  | 'unblocked_ready'
  | 'overdue'
  | 'due_today'
  | 'in_progress'
  | 'waiting_review'
  | 'waiting_blocked'
  | 'upcoming';

export type ActionCenterItem = {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  updated_at: string | null;
  review_version: number;
  action_type: ActionType;
  badge_label: string;
  badge_variant: 'action' | 'warn' | 'success' | 'info' | 'muted';
  acknowledgement_id?: string | null;
  reviewer_target?: string | null;
  blocking_titles?: string | null;
  sla_days?: number;
  sla_tier?: 'fresh' | 'aging' | 'stalled';
};

export type ActionCenterData = {
  today: string;
  userName: string;
  needsAction: ActionCenterItem[];
  activeWork: ActionCenterItem[];
  waitingOnOthers: ActionCenterItem[];
  counts: {
    needsAction: number;
    activeWork: number;
    waitingOnOthers: number;
    total: number;
  };
};

export async function getActionCenterData(): Promise<ActionCenterData> {
  const today = todayKey();
  return workspaceRead(async (db, userId) => {
    // 1. Current user details
    const userRow = (
      await db.query<{ full_name: string | null; email: string; role: string }>(
        'SELECT full_name, email, role FROM profiles WHERE id = $1',
        [userId]
      )
    ).rows[0];
    const rawName = userRow?.full_name?.trim();
    const userName = rawName ? rawName.split(' ')[0] : userRow?.email?.split('@')[0] || 'Teammate';
    const isAdmin = userRow?.role === 'admin';

    // 2. Query A: Reviews waiting on the current user's decision
    const reviewRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        review_version: number;
        creator_name: string | null;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text, t.review_version,
               coalesce(cr.full_name, cr.email, 'Teammate') AS creator_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN profiles cr ON cr.id = t.created_by
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND public.can_work_project(t.project_id)
          AND t.status = 'in_review'
          AND NOT ($1::uuid = ANY(t.assignee_ids))
          AND ($2::boolean OR (public.review_enabled() AND t.created_by = $1::uuid))
        ORDER BY t.updated_at ASC, t.title
      `,
        [userId, isAdmin]
      )
    ).rows;

    // 3. Query B: Assignments waiting for current user's acknowledgement
    const ackRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        review_version: number;
        acknowledgement_id: string;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text, t.review_version,
               ack.id AS acknowledgement_id
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        JOIN task_acknowledgements ack ON ack.task_id = t.id AND ack.user_id = $1::uuid
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND t.status NOT IN ('done')
          AND ack.accepted_at IS NULL
          AND $1::uuid = ANY(t.assignee_ids)
        ORDER BY t.created_at DESC, t.title
      `,
        [userId]
      )
    ).rows;

    // 4. Query C: All active tasks assigned to the current user
    const myTaskRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        review_version: number;
        has_deps: boolean;
        all_deps_done: boolean;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text, t.review_version,
               EXISTS (SELECT 1 FROM task_dependencies d WHERE d.task_id = t.id) AS has_deps,
               NOT EXISTS (
                 SELECT 1 FROM task_dependencies d2
                 JOIN tasks t2 ON t2.id = d2.depends_on
                 WHERE d2.task_id = t.id AND t2.status <> 'done'
               ) AS all_deps_done
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND $1::uuid = ANY(t.assignee_ids)
          AND t.status <> 'done'
        ORDER BY
          CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          t.due_date ASC NULLS LAST,
          t.title
      `,
        [userId]
      )
    ).rows;

    // 5. Query D: Tasks waiting on others (either submitted for review by others, or blocked)
    const waitingRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        review_version: number;
        creator_name: string | null;
        blocking_titles: string | null;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text, t.review_version,
               coalesce(cr.full_name, cr.email, 'Admin') AS creator_name,
               (
                 SELECT string_agg(t2.title, ', ')
                 FROM task_dependencies td
                 JOIN tasks t2 ON t2.id = td.depends_on
                 WHERE td.task_id = t.id AND t2.status <> 'done'
               ) AS blocking_titles
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN profiles cr ON cr.id = t.created_by
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND (
            (t.status = 'in_review' AND ($1::uuid = ANY(t.assignee_ids) OR t.created_by = $1::uuid)
             AND NOT ($2::boolean OR (public.review_enabled() AND t.created_by = $1::uuid AND NOT ($1::uuid = ANY(t.assignee_ids)))))
            OR
            (t.status = 'blocked' AND ($1::uuid = ANY(t.assignee_ids) OR t.created_by = $1::uuid))
          )
        ORDER BY t.updated_at DESC, t.title
      `,
        [userId, isAdmin]
      )
    ).rows;

    // Build the three buckets:
    const needsAction: ActionCenterItem[] = [];
    const activeWork: ActionCenterItem[] = [];
    const waitingOnOthers: ActionCenterItem[] = [];

    // Bucket 1: Needs My Action
    // A) Reviews waiting on me
    for (const r of reviewRows) {
      const aging = getReviewAging({ status: 'in_review', updatedAt: r.updated_at });
      needsAction.push({
        id: r.id,
        project_id: r.project_id,
        project_name: r.project_name,
        title: r.title,
        status: r.status,
        priority: r.priority,
        due_date: r.due_date,
        updated_at: r.updated_at,
        review_version: r.review_version,
        action_type: 'review_needed',
        badge_label:
          aging?.tier === 'stalled'
            ? `Review stalled (${aging.days}d)`
            : aging?.tier === 'aging'
              ? `Review aging (${aging.days}d)`
              : 'Review requested',
        badge_variant: aging?.tier === 'stalled' ? 'warn' : 'action',
        reviewer_target: r.creator_name,
        sla_days: aging?.days,
        sla_tier: aging?.tier,
      });
    }

    // B) Pending acknowledgements
    for (const a of ackRows) {
      needsAction.push({
        id: a.id,
        project_id: a.project_id,
        project_name: a.project_name,
        title: a.title,
        status: a.status,
        priority: a.priority,
        due_date: a.due_date,
        updated_at: a.updated_at,
        review_version: a.review_version,
        action_type: 'accept_needed',
        badge_label: 'Accept assignment',
        badge_variant: 'action',
        acknowledgement_id: a.acknowledgement_id,
      });
    }

    // C) Newly unblocked tasks ready to start (dependencies satisfied)
    const unblockedTasks = myTaskRows.filter(
      t =>
        t.status === 'todo' &&
        t.has_deps &&
        t.all_deps_done &&
        !needsAction.some(item => item.id === t.id)
    );
    for (const u of unblockedTasks) {
      needsAction.push({
        id: u.id,
        project_id: u.project_id,
        project_name: u.project_name,
        title: u.title,
        status: u.status,
        priority: u.priority,
        due_date: u.due_date,
        updated_at: u.updated_at,
        review_version: u.review_version,
        action_type: 'unblocked_ready',
        badge_label: 'Ready to start',
        badge_variant: 'success',
      });
    }

    // D) Overdue or Due Today assigned tasks not already captured
    const urgentTasks = myTaskRows.filter(
      t =>
        t.status !== 'in_review' &&
        t.status !== 'done' &&
        t.due_date &&
        t.due_date <= today &&
        !needsAction.some(item => item.id === t.id)
    );
    for (const urg of urgentTasks) {
      const isOverdue = urg.due_date! < today;
      needsAction.push({
        id: urg.id,
        project_id: urg.project_id,
        project_name: urg.project_name,
        title: urg.title,
        status: urg.status,
        priority: urg.priority,
        due_date: urg.due_date,
        updated_at: urg.updated_at,
        review_version: urg.review_version,
        action_type: isOverdue ? 'overdue' : 'due_today',
        badge_label: isOverdue ? 'Overdue' : 'Due today',
        badge_variant: isOverdue ? 'warn' : 'action',
      });
    }

    // Bucket 2: My Active Work
    // In progress tasks assigned to me
    const inProgressTasks = myTaskRows.filter(t => t.status === 'in_progress');
    for (const ip of inProgressTasks) {
      activeWork.push({
        id: ip.id,
        project_id: ip.project_id,
        project_name: ip.project_name,
        title: ip.title,
        status: ip.status,
        priority: ip.priority,
        due_date: ip.due_date,
        updated_at: ip.updated_at,
        review_version: ip.review_version,
        action_type: 'in_progress',
        badge_label: 'In progress',
        badge_variant: 'info',
      });
    }

    // Upcoming tasks assigned to me (not in needsAction or activeWork)
    const upcomingTasks = myTaskRows.filter(
      t =>
        t.status === 'todo' &&
        !needsAction.some(item => item.id === t.id) &&
        !activeWork.some(item => item.id === t.id)
    );
    for (const up of upcomingTasks) {
      activeWork.push({
        id: up.id,
        project_id: up.project_id,
        project_name: up.project_name,
        title: up.title,
        status: up.status,
        priority: up.priority,
        due_date: up.due_date,
        updated_at: up.updated_at,
        review_version: up.review_version,
        action_type: 'upcoming',
        badge_label: up.due_date ? `Due ${up.due_date}` : 'To do',
        badge_variant: 'muted',
      });
    }

    // Bucket 3: Waiting on Others
    for (const w of waitingRows) {
      if (w.status === 'in_review') {
        const aging = getReviewAging({ status: 'in_review', updatedAt: w.updated_at });
        waitingOnOthers.push({
          id: w.id,
          project_id: w.project_id,
          project_name: w.project_name,
          title: w.title,
          status: w.status,
          priority: w.priority,
          due_date: w.due_date,
          updated_at: w.updated_at,
          review_version: w.review_version,
          action_type: 'waiting_review',
          badge_label: `Waiting on ${w.creator_name || 'Reviewer'}${aging ? ` (${aging.days}d)` : ''}`,
          badge_variant: aging?.tier === 'stalled' ? 'warn' : 'info',
          reviewer_target: w.creator_name,
          sla_days: aging?.days,
          sla_tier: aging?.tier,
        });
      } else if (w.status === 'blocked') {
        waitingOnOthers.push({
          id: w.id,
          project_id: w.project_id,
          project_name: w.project_name,
          title: w.title,
          status: w.status,
          priority: w.priority,
          due_date: w.due_date,
          updated_at: w.updated_at,
          review_version: w.review_version,
          action_type: 'waiting_blocked',
          badge_label: w.blocking_titles ? `Blocked by ${w.blocking_titles}` : 'Blocked',
          badge_variant: 'warn',
          blocking_titles: w.blocking_titles,
        });
      }
    }

    return {
      today,
      userName,
      needsAction,
      activeWork,
      waitingOnOthers,
      counts: {
        needsAction: needsAction.length,
        activeWork: activeWork.length,
        waitingOnOthers: waitingOnOthers.length,
        total: needsAction.length + activeWork.length + waitingOnOthers.length,
      },
    };
  });
}
