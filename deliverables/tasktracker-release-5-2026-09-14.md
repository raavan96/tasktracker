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

Passed on application commit `18af5c6e4c558191df4874960ab76c3db2e5d96b`:

- Local lint and TypeScript checks; 34 unit tests.
- PGlite integration across all ten migrations, including actual planning queries/actions under authenticated RLS, private/revoked/inactive access, reset checklists, copied internal dependencies, retry handling and calendar privacy.
- [Linux build and eight-session PostgreSQL 16 browser workflow](https://github.com/raavan96/tasktracker/actions/runs/34832075700): all steps passed. The Linux artifact is `tasktracker-postgres-staging`; its archive contains the SHA-256 file used at deployment.
- Browser task/template/project copy flows, multiple assignees, permission denial, excluded attachments, calendar filtering and task-panel navigation.
- 375px and 430px overflow checks; saved light/dark previews visually reviewed. These are Chromium viewport checks, not certification on physical iPhone Safari.
- Existing review, member lifecycle, archive, search, reporting, CSV and 1,000-task pagination checks also passed.

## Production deployment — 14 September 2026, 10:21 UTC

Release `d77ad789d47538aff805cbf15ae482bbd1b88b8a` is live at https://168.144.155.51. [Exact release CI](https://github.com/raavan96/tasktracker/actions/runs/34832472522) passed all build, database and browser steps.

- Artifact SHA-256: `50d829b9f3f1006cf23ffe0317c3fd95f7bf567f97098ef2d5935dadbb828132`.
- Rehearsal on a disposable production snapshot preserved all existing row fingerprints. The rehearsal database was removed afterwards.
- Fresh consistent backup: `/var/backups/tasktracker/20260914T102137537397Z`; database SHA-256 `2f0a5e27804443b28422a0bba7cf67da57ed3049b52bbf58b79d6208f8c3c11a`.
- Migration 010 applied; all 22 compared table fingerprints remained unchanged, including 12 accounts, four projects and seven tasks.
- App now runs from `/opt/tasktracker-releases/d77ad78`. Backup, migration, switch and automation verification completed in 4.9 seconds.
- HTTPS login returned 200. Signed-in calendar, template library, project actions and project-copy preview loaded successfully. No test work was saved in production.
- App active with zero automatic restarts; reminders/recurrence, backup and certificate timers active. Creator/admin review and no-self-approval policies remain enabled.
- Deployment record: `/var/backups/tasktracker/release5-deployment.json`. Previous unit: `/etc/tasktracker-release5-d77ad78.service.previous`, pointing to `/opt/tasktracker-releases/fbbf7b3`.

For an app rollback, restore the previous service unit and restart the service. Retain migration 010 and all newer user work; do not overwrite the database with the pre-deployment snapshot.
