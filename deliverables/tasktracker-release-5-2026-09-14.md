# Release 5 — Reusable planning and calendar

## Included

- Project and task actions contain Duplicate and Save as template, available to readers without granting edit/delete permission on the original.
- Personal templates preserve titles, descriptions, priorities, reusable checklist steps and relative deadlines. Templates remain tied to source-project access and are removed with that project. They are immutable snapshots; delete and save a new version when the process changes.
- A preview lets the user name the copy, choose the destination/project members, assign multiple people per task, and review or shift deadlines. Unassigned is the default. New projects are private and the current actor is the creator.
- Copies start as To do, with unchecked checklists. Dependencies between copied tasks are remapped to new IDs. External dependencies, notes, remarks, attachments, approvals, history and recurring schedules are excluded. Project copies include non-archived tasks, including completed tasks reset to To do.
- Month/week calendar filters by project and assignee. Shared tasks appear once. Mobile uses an agenda of days with tasks. Task links open the existing details panel. An undated-task count links to a matching task-table filter.

## Boundaries

- Maximum 100 tasks and 500 checklist steps in one copy, 30 selected project members/assignees, and 200 visible personal templates. Oversized requests fail instead of partially creating work.
- Calendar displays at most 500 tasks in the date range, with an explicit narrowing-filter message when more match. Dates use Asia/Kolkata.
- No capacity estimates, drag-and-drop rescheduling, offline editing or PWA installation in this release.
- Templates retain source text privately; removing project access hides them. A template is not a shared workspace document.
- Network retries reuse a request ID within the open preview. The same request returns the existing copy. After an uncertain result, retry before refreshing; changing an already-saved request requires a fresh preview.

## Deployment plan

1. Pass lint, TypeScript, unit/PGlite integration and the complete eight-session PostgreSQL 16 browser workflow on the exact release commit.
2. Verify the Linux artifact SHA and take a fresh database plus attachments backup. Rehearse migration on a disposable copy of the database; check existing-row counts/fingerprints.
3. Apply only `postgres/010_planning.sql` as the database owner. It adds two RLS-protected tables and a calendar index; it does not rewrite existing tasks or projects. Do not run the fresh-database initialization script on production.
4. Switch the app service to the verified release directory, retaining its existing environment and resource limits. Check HTTPS login/dashboard and the new pages, then inspect service logs and existing timer health.
5. Roll back by restoring the previous app service directory. Leave the additive schema and any newly created projects/tasks/templates intact. Do not restore an old database over new user work.

## Verification status

Local lint, TypeScript, unit and PGlite checks are being completed; exact CI/build evidence will be appended after the run. Production has not been changed for Release 5.
