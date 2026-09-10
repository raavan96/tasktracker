-- Run and commit before the next migration: PostgreSQL enum values need a commit.
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'in_review';
