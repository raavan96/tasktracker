BEGIN;
ALTER TABLE task_acknowledgements ADD COLUMN acceptance_source text NOT NULL DEFAULT 'member' CHECK(acceptance_source IN ('member','administrative'));
COMMIT;
