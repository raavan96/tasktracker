import { currentUser } from '@/lib/postgres/auth';
import { transaction } from '@/lib/postgres/db';
import { getDailyStandupData } from '@/lib/daily-standup';
import { randomUUID } from 'crypto';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return json({ error: 'Please sign in again.' }, 401);
  }

  try {
    const data = await getDailyStandupData();
    return json({ success: true, data });
  } catch {
    return json({ error: 'Could not generate daily standup. Please try again.' }, 500);
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return json({ error: 'Please sign in again.' }, 401);
  }

  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== request.headers.get('host')) {
    return json({ error: 'Invalid request origin.' }, 403);
  }

  try {
    const bodyText = await request.text();
    if (bodyText.length > 20000) {
      return json({ error: 'Payload too large.' }, 400);
    }
    const data = JSON.parse(bodyText);

    if (data.action === 'share') {
      const { projectId, message } = data;
      if (!uuidRegex.test(projectId || '')) {
        return json({ error: 'Invalid project ID.' }, 400);
      }
      if (typeof message !== 'string' || message.trim().length === 0 || message.length > 4000) {
        return json({ error: 'Message must be between 1 and 4000 characters.' }, 400);
      }

      return await transaction(user.id, async db => {
        await db.query('SELECT assert_active()');

        // 1. Verify project exists, not archived, and user has access
        const prj = (
          await db.query<{ id: string; name: string }>(
            `
            SELECT id, name FROM projects
            WHERE id = $1 AND NOT is_archived
              AND (is_admin() OR created_by = $2 OR EXISTS (
                SELECT 1 FROM project_members pm WHERE pm.project_id = id AND pm.user_id = $2
              ))
          `,
            [projectId, user.id]
          )
        ).rows[0];

        if (!prj) {
          return json({ error: 'You do not have permission to post to this project.' }, 403);
        }

        // 2. Open or get project chat conversation
        const convRes = await db.query<{ id: string }>('SELECT open_chat($1, NULL) id', [
          projectId,
        ]);
        const conversationId = convRes.rows[0]?.id;
        if (!conversationId) {
          return json({ error: 'Could not access project chat.' }, 500);
        }

        // 3. Send message via send_chat
        const nonce = randomUUID();
        const msgRes = await db.query<{ id: string }>(
          'SELECT send_chat($1, $2, NULL, $3::uuid[], $4)::text id',
          [conversationId, message.trim(), [], nonce]
        );

        return json({
          success: true,
          messageId: msgRes.rows[0]?.id,
          projectName: prj.name,
        });
      });
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return json(
      {
        error:
          e.code === 'P0001'
            ? e.message
            : 'Could not share standup. Please try again.',
      },
      400
    );
  }
}
