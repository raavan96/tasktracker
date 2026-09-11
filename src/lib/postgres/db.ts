import 'server-only';
import { Pool, type PoolClient, types } from 'pg';
// Match the existing API's date strings, including calendar dates without a timezone.
types.setTypeParser(1082, value => value);
types.setTypeParser(1184, value => new Date(value).toISOString());
const state = globalThis as typeof globalThis & { tasktrackerPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL mode.');
  if (!state.tasktrackerPool) {
    state.tasktrackerPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4,
      connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000,
      application_name: 'tasktracker-staging' });
    state.tasktrackerPool.on('error', () => console.error('PostgreSQL connection failed.'));
  }
  return state.tasktrackerPool;
}
export async function transaction<T>(userId: string | null, work: (db: PoolClient) => Promise<T>, privileged = false): Promise<T> {
  const db = await pool().connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId || '']);
    await db.query(privileged ? 'SET LOCAL ROLE service_role' : 'SET LOCAL ROLE authenticated');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { db.release(); }
}
