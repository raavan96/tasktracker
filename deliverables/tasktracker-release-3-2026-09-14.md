# Release 3 — People and review controls

Deployed successfully on 14 September 2026 at approximately 13:15 IST (07:45 UTC). Live source: `db59fea025913ef255b6693f0a449ba4ac7ae78f`.

[Open TaskTracker](https://168.144.155.51/dashboard) · [Successful Linux build and browser checks](https://github.com/raavan96/tasktracker/actions/runs/34819035095)

The coordinated switch took 5.8 seconds. All pre-existing records were preserved: 12 accounts/profiles, 3 projects, 5 tasks, 9 memberships, 1 remark, 13 task-history records, 3 checklist items, 11 notifications, and archive configuration. No production records were changed for workflow tests.

Artifact SHA-256: `82f079d3b4823b8bcc0122bc2a6c8902fd380a738be8978407fb54d7f8b49803`.
Migration SHA-256: `36f7d0d96d2f837ffcfc279ec89c14a8f309ed60094e28f00aa440b5ea847b92`.
Final backup: `/var/backups/tasktracker/20260914T074527837478Z` on the server; database digest `1f0722b60fb7d19716fa6143545adc438211d7cc9ef86b46881882ec04e41718`.

Post-deployment verification: HTTPS login 200; authenticated dashboard and member management load; creator/admin policy visibly enabled; affected-work preview loads with the correct pending-task count; project task panel shows explicit review controls and retained checklist/history. The app is active with zero automatic restarts and approximately 71 MiB resident service memory at inspection. Automation completed successfully; automation, backup and certificate timers are scheduled. No new application errors appeared after startup.

## Included

- Active/inactive/all member filters, retained inactive labels and per-member affected-work summaries.
- Admin deactivation/reactivation with a required reason, immediate session revocation and history preservation. Password reset does not reactivate a disabled account.
- Pending-task reassignment by project, with an exact versioned preview. Replacements must be active existing project members. Completed/archived work and Created by values remain unchanged.
- Explicit submission, approval, request changes, withdrawal and reopening. Changes/withdrawal/reopening require reasons recorded with actor and time.
- Creator or admin approval of delegated work, with no self-approval, including admins assigned to themselves. Another eligible reviewer is required.
- Versioned decisions and row locking prevent stale or duplicate approvals. Editing submitted task details invalidates the submission. Checklists, dependencies and attachments cannot be changed while submitted/completed; withdraw or reopen first.
- Inactive accounts cannot receive new assignments or memberships. Their recurring work is held, deadline reminders skip them, and resumption skips missed recurrence dates.
- Admin role changes explain access consequences. Self-deactivation/self-demotion and removal of the last active admin are blocked; concurrent admin changes serialize safely.
- Runtime account deletion is blocked even if an older application build is restored.

## Validation

- ESLint and TypeScript checks.
- 28 unit/action/authentication tests.
- PGlite regression and Release 3 database tests: privacy, review permissions, direct-write bypasses, reasons, stale versions, inactive sessions/RLS, reassignment, recurrence/reminder holds, history and archive behavior.
- Linux CI builds against PostgreSQL 16 and runs eight Chromium sessions. Browser tests cover member creator approval, requested changes, admin self-approval denial, deactivation/session denial/reactivation, existing project/task workflows, attachments, archives, member details and CSV export.
- Real PostgreSQL concurrency tests: competing reviewers produce one approval, and competing admin demotions retain an active admin.
- Both themes retain the same geometry at 1440px and 430px. A physical iPhone Safari check is separate from Chromium viewport testing.
- Production-snapshot rehearsal applies migration 007 only, compares complete row fingerprints for 15 existing tables and verifies active-account mirroring. Rehearsal database is removed afterward; the snapshot and evidence remain under `/var/lib/pgsql/tasktracker-release3-qa-20260914` on the server.

## Operations and rollback

Production database remains `tasktracker_rehearsal_final_20260911` on local PostgreSQL port 55433. The historical database name is not an instruction to treat it as disposable.

Migration `postgres/007_people_review.sql` is additive and transactional, and must run exactly once as the database owner. Its initial review setting is admin-only; the agreed creator/admin policy is enabled after compatible application health checks. Turning creator review off still blocks self-approval and direct completion bypasses.

Deployment pauses the application and automation, takes a fresh consistent database/attachment backup, verifies its digest, applies the migration, compares existing record fingerprints, switches the systemd WorkingDirectory to the verified Linux artifact and checks home/login responses. Automation resumes after the checks pass. Existing environment, passwords and file storage stay in place.

If deployment fails before migration commits, retain the original app/schema. After migration commits, retain the additive schema and all lifecycle/review data. The previous application can serve existing work in an emergency, but its generic review actions will be rejected by the new database guards. Prefer a forward fix. Disabling creator review is an admin-only operational fallback, not a database downgrade. Never restore an older whole-database backup over new live work.

The previous unit is retained under `/etc/tasktracker-r3-db59fea.service.previous`. Root-only deployment evidence and the selected backup path are recorded at `/var/backups/tasktracker/release3-deployment.json`.
