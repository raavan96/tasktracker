import 'server-only';
import { workspaceRead } from './workspace-data';
import { todayKey } from './task-presentation';
import { getReviewAging } from './review-aging';
import type { StandupItem, DailyStandupData, StandupItemType } from './standup-format';

export * from './standup-format';

/**
 * Server-side query fetching all raw tasks and compiling DailyStandupData.
 */
export async function getDailyStandupData(): Promise<DailyStandupData> {
  const dateKey = todayKey();
  const dateObj = new Date();
  const dateStr = dateObj.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return workspaceRead(async (db, userId) => {
    // 1. Current user
    const userRow = (
      await db.query<{ full_name: string | null; email: string; role: string }>(
        'SELECT full_name, email, role FROM profiles WHERE id = $1',
        [userId]
      )
    ).rows[0];
    const rawName = userRow?.full_name?.trim();
    const userName = rawName
      ? rawName.split(' ')[0]
      : userRow?.email?.split('@')[0] || 'Teammate';
    const userEmail = userRow?.email || '';
    const isAdmin = userRow?.role === 'admin';

    // 2. Accomplished: tasks marked 'done' in the last 48 hours
    const completedRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND ($1::uuid = ANY(t.assignee_ids) OR t.created_by = $1::uuid)
          AND t.status = 'done'
          AND t.updated_at >= now() - interval '48 hours'
        ORDER BY t.updated_at DESC, t.title
        LIMIT 10
      `,
        [userId]
      )
    ).rows;

    // 3. Submitted for review in the last 48 hours
    const submittedRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        creator_name: string | null;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text,
               coalesce(cr.full_name, cr.email, 'Admin') AS creator_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN profiles cr ON cr.id = t.created_by
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND t.status = 'in_review'
          AND ($1::uuid = ANY(t.assignee_ids) OR t.created_by = $1::uuid)
          AND t.updated_at >= now() - interval '48 hours'
        ORDER BY t.updated_at DESC, t.title
        LIMIT 10
      `,
        [userId]
      )
    ).rows;

    const accomplished: StandupItem[] = [
      ...completedRows.map(r => ({
        id: r.id,
        title: r.title,
        projectId: r.project_id,
        projectName: r.project_name,
        type: 'completed' as const,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date,
        updatedAt: r.updated_at,
      })),
      ...submittedRows.map(r => ({
        id: r.id,
        title: r.title,
        projectId: r.project_id,
        projectName: r.project_name,
        type: 'submitted_review' as const,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date,
        updatedAt: r.updated_at,
      })),
    ];

    // 4. Working on: in_progress tasks + active to-do tasks
    const activeRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        has_deps: boolean;
        all_deps_done: boolean;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text,
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
          AND t.status IN ('in_progress', 'todo')
        ORDER BY
          CASE t.status WHEN 'in_progress' THEN 0 ELSE 1 END,
          CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          t.due_date ASC NULLS LAST,
          t.title
        LIMIT 15
      `,
        [userId]
      )
    ).rows;

    const workingOn: StandupItem[] = activeRows.map(r => {
      let type: StandupItemType = 'planned';
      if (r.status === 'in_progress') {
        type = 'in_progress';
      } else if (r.has_deps && r.all_deps_done) {
        type = 'ready_to_start';
      }
      return {
        id: r.id,
        title: r.title,
        projectId: r.project_id,
        projectName: r.project_name,
        type,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date,
        updatedAt: r.updated_at,
      };
    });

    // 5. Blockers: blocked tasks with dependency names
    const blockedRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        blocking_titles: string | null;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text,
               (
                 SELECT string_agg(t2.title, ', ')
                 FROM task_dependencies td
                 JOIN tasks t2 ON t2.id = td.depends_on
                 WHERE td.task_id = t.id AND t2.status <> 'done'
               ) AS blocking_titles
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND ($1::uuid = ANY(t.assignee_ids) OR t.created_by = $1::uuid)
          AND t.status = 'blocked'
        ORDER BY t.priority DESC, t.title
        LIMIT 10
      `,
        [userId]
      )
    ).rows;

    // 6. Blockers: Stalled / aging review requests
    const waitingReviewRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
        creator_name: string | null;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text,
               coalesce(cr.full_name, cr.email, 'Admin') AS creator_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN profiles cr ON cr.id = t.created_by
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND t.status = 'in_review'
          AND ($1::uuid = ANY(t.assignee_ids) OR t.created_by = $1::uuid)
          AND NOT ($2::boolean OR (public.review_enabled() AND t.created_by = $1::uuid AND NOT ($1::uuid = ANY(t.assignee_ids))))
        ORDER BY t.updated_at ASC, t.title
        LIMIT 10
      `,
        [userId, isAdmin]
      )
    ).rows;

    // 7. Blockers: Overdue tasks
    const overdueRows = (
      await db.query<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        updated_at: string | null;
      }>(
        `
        SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.priority,
               t.due_date::text, t.updated_at::text
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE NOT t.is_archived AND NOT p.is_archived
          AND $1::uuid = ANY(t.assignee_ids)
          AND t.status NOT IN ('done', 'in_review', 'blocked')
          AND t.due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
        ORDER BY t.due_date ASC, t.title
        LIMIT 10
      `,
        [userId]
      )
    ).rows;

    const blockers: StandupItem[] = [
      ...blockedRows.map(r => ({
        id: r.id,
        title: r.title,
        projectId: r.project_id,
        projectName: r.project_name,
        type: 'blocked' as const,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date,
        detail: r.blocking_titles
          ? `Blocked by: ${r.blocking_titles}`
          : 'Waiting on prerequisite dependencies',
        updatedAt: r.updated_at,
      })),
      ...waitingReviewRows.reduce<StandupItem[]>((acc, r) => {
        const aging = getReviewAging({
          status: r.status,
          updatedAt: r.updated_at,
        });
        if (aging && (aging.tier === 'aging' || aging.tier === 'stalled')) {
          acc.push({
            id: r.id,
            title: r.title,
            projectId: r.project_id,
            projectName: r.project_name,
            type: 'review_delay',
            status: r.status,
            priority: r.priority,
            dueDate: r.due_date,
            detail: `Review waiting on ${r.creator_name} (${aging.days}d)`,
            updatedAt: r.updated_at,
          });
        }
        return acc;
      }, []),
      ...overdueRows.map(r => ({
        id: r.id,
        title: r.title,
        projectId: r.project_id,
        projectName: r.project_name,
        type: 'overdue' as const,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date,
        detail: `Overdue (deadline: ${r.due_date})`,
        updatedAt: r.updated_at,
      })),
    ];

    // 8. Projects user belongs to (for chat sharing)
    const projects = (
      await db.query<{ id: string; name: string }>(
        `
        SELECT p.id, p.name
        FROM projects p
        WHERE NOT p.is_archived
          AND ($1::boolean OR p.created_by = $2::uuid OR EXISTS (
            SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2::uuid
          ))
        ORDER BY p.name ASC
      `,
        [isAdmin, userId]
      )
    ).rows;

    return {
      date: dateStr,
      dateKey,
      userName,
      userEmail,
      accomplished,
      workingOn,
      blockers,
      projects,
    };
  });
}
