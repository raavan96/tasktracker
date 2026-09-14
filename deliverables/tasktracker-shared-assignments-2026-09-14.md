# Project views and shared task assignments — deployed 14 September 2026

Live source: `fbbf7b324ff97a63cd32601d06850a576d514da0`.
CI: https://github.com/raavan96/tasktracker/actions/runs/34828684156

## Behavior

- Projects support list/grid views, small/large grids, and sorting by creation date, name, completion percentage or open task count. Preferences persist, and URL parameters can override them.
- The searchable task assignee picker accepts multiple active project members. Every assignee sees the shared task in My Tasks and workload counts. Global task totals still count the task once.
- Any assignee or admin can submit one shared status for review. Approval belongs to the eligible creator/admin outside the entire assignee group. Assigned admins and assigned creators cannot self-approve.
- Review actions are rendered only for relevant task states and permitted users. Completed/archived tasks no longer display irrelevant submission/approval buttons. Feedback stays available for applicable changes, withdrawal and reopening.
- Shared assignment groups flow through status/supporting-work permissions, reminders, assignment/review notifications, recurrence templates, approval snapshots, reports/CSV, member impact counts and reassignment. Assignment changes remain versioned and invalidate outstanding reviews.

## Checks

Lint, TypeScript/Linux production build, 33 unit/action/authentication tests, PostgreSQL permission/migration suites and the full eight-session Chromium workflow passed. Shared-task browser tests exercised the multi-select form, My Tasks for both assignees, submission by the second assignee, eligible admin approval and hidden review buttons after completion. Project view/size/sort preferences survived reloads. Existing mobile-width, archive, account lifecycle, preview, reports and 1,000-task export checks remained green.

A disposable database restored from production passed migration 009 with existing-row fingerprints preserved across 21 tables. Production received only migration 009, with the app paused during the coordinated backup/switch. Existing 12 users, 4 projects, 7 tasks, 17 memberships, 2 remarks and 17 history entries were preserved. The switch took 5.5 seconds. No real task/account writes were used for browser QA.

Authenticated live checks confirmed the sorted project list, project controls, searchable multi-assignee form and restricted approval controls. HTTPS returned 200; the app had zero restarts and about 79 MiB memory use after checks. Automation completed successfully; automation, backup and certificate timers remained active. Physical iPhone Safari testing is still separate from Chromium viewport coverage.

## Operational evidence

- Release: `/opt/tasktracker-releases/fbbf7b3`
- Artifact SHA-256: `9460d64d34920eb864c2773cab085d04ea26ba0635e31bb7c293f699c4d06959`
- Migration: `postgres/009_shared_assignments.sql`
- Fresh backup: `/var/backups/tasktracker/20260914T093810586209Z`
- Database backup SHA-256: `b85367c4697fc1e107668c0348ea69f038b3cfa3fddbc6de127c71006e1a2caf`
- Server record: `/var/backups/tasktracker/shared-assignment-deployment.json`
- Previous service unit: `/etc/tasktracker-shared-fbbf7b3.service.previous`
- Previous app: `/opt/tasktracker-releases/f1d6747`

Keep migration 009 and its functions on an app rollback so shared assignees, schedules and no-self-approval enforcement survive. An older UI shows only the compatibility assignee and does not expose the group correctly; prefer a forward fix. Do not restore an old database over newer team writes.
