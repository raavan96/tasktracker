import { currentUser } from '@/lib/postgres/auth';
import { searchWorkspace, workspaceRead } from '@/lib/workspace-data';
import type { CommandItem } from '@/lib/command-palette-items';

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) {
    return json({ error: 'Please sign in again.' }, 401);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  try {
    if (q) {
      // Live search using workspace search index with title-first ranking
      const searchResult = await searchWorkspace(q, false, 1);
      const items = searchResult.items;

      const projects: CommandItem[] = items
        .filter(i => i.kind === 'Project')
        .slice(0, 5)
        .map(p => ({
          id: 'proj-' + p.id,
          title: p.title,
          subtitle: 'Project',
          category: 'Projects',
          url: p.url,
          iconName: 'folder',
        }));

      const tasks: CommandItem[] = items
        .filter(i => i.kind === 'Task')
        .slice(0, 8)
        .map(t => ({
          id: 'task-' + t.id,
          title: t.title,
          subtitle: 'in ' + t.project_name,
          category: 'Tasks',
          url: t.url,
          iconName: 'task',
        }));

      const notes: CommandItem[] = items
        .filter(i => i.kind === 'Project note' || i.kind === 'Task remark')
        .slice(0, 3)
        .map(n => ({
          id: 'note-' + n.id,
          title: n.title,
          subtitle: `${n.kind} in ${n.project_name}`,
          category: 'Notes',
          url: n.url,
          iconName: 'sparkles',
        }));

      return json({
        success: true,
        projects,
        tasks,
        notes,
      });
    }

    // Default: fetch top recent active projects and assigned tasks
    const recent = await workspaceRead(async (db, userId) => {
      const projects = (
        await db.query<{ id: string; name: string }>(
          `SELECT id, name FROM projects
           WHERE NOT is_archived
           ORDER BY updated_at DESC
           LIMIT 5`
        )
      ).rows;

      // Try fetching active tasks assigned to user
      let taskRows = (
        await db.query<{ id: string; title: string; project_id: string; project_name: string }>(
          `SELECT t.id, t.title, p.id AS project_id, p.name AS project_name
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           WHERE NOT t.is_archived AND NOT p.is_archived
             AND ($1 = ANY(t.assignee_ids) OR t.assignee_id = $1)
             AND t.status != 'done'
           ORDER BY coalesce(t.due_date, '9999-12-31') ASC, t.updated_at DESC
           LIMIT 6`,
          [userId]
        )
      ).rows;

      // If user has no directly assigned active tasks, fetch recent active tasks across visible projects
      if (taskRows.length === 0) {
        taskRows = (
          await db.query<{ id: string; title: string; project_id: string; project_name: string }>(
            `SELECT t.id, t.title, p.id AS project_id, p.name AS project_name
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             WHERE NOT t.is_archived AND NOT p.is_archived
               AND t.status != 'done'
             ORDER BY coalesce(t.due_date, '9999-12-31') ASC, t.updated_at DESC
             LIMIT 6`
          )
        ).rows;
      }

      return {
        projects: projects.map(
          (p): CommandItem => ({
            id: 'proj-' + p.id,
            title: p.name,
            subtitle: 'Recent project',
            category: 'Projects',
            url: `/dashboard/projects/${p.id}`,
            iconName: 'folder',
          })
        ),
        tasks: taskRows.map(
          (t): CommandItem => ({
            id: 'task-' + t.id,
            title: t.title,
            subtitle: `in ${t.project_name}`,
            category: 'Tasks',
            url: `/dashboard/projects/${t.project_id}?task=${t.id}`,
            iconName: 'task',
          })
        ),
      };
    });

    return json({
      success: true,
      projects: recent.projects,
      tasks: recent.tasks,
      notes: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return json({ error: message }, 500);
  }
}
