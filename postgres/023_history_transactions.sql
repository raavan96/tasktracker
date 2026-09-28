BEGIN;
-- Historical rows stay unlinked. No timestamp-based backfill or invented events.
ALTER TABLE public.workspace_history ADD COLUMN transaction_id text;
ALTER TABLE public.workspace_history ALTER COLUMN transaction_id SET DEFAULT pg_current_xact_id()::text;
COMMIT;
