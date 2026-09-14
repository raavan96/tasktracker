# Release 4 — deployed 14 September 2026

Live: https://168.144.155.51/dashboard

## Delivered

- Search accessible projects, tasks, project notes and remarks, with archived-work inclusion and contextual links.
- Date-range reports with project/assignee filters, weekly completion activity, archived completions, approval-time assignee/deadline snapshots and CSV export. Historical unknown fields remain labelled; current overdue counts are separate from historical activity.
- Database-filtered task tables: stable sorting, 25-row pages, full-result counts and CSV exports. Exports explicitly reject more than 10,000 results rather than truncating.
- Version checks for task edits, quick status changes, project edits and note updates. Conflicting task/remark drafts are retained with explicit recovery controls.
- Lazy, bounded remarks/history; authors can edit their remarks and inspect previous versions. Project-access-checked mentions notify teammates in-app without email.
- Content-sniffed raster/PDF previews, private access checks, download fallback, uploader attribution and upload progress. HTML/SVG remain downloads. Pending uploads/schedule saves protect the drawer from dismissal.
- Separate future recurrence templates, preview dates, pause/resume, inclusive end dates, month-end anchors and schedule history. Existing task details and approval history stay unchanged.

Creator/admin approval without self-approval remains enabled. Existing archive, account lifecycle, backup and certificate automation remains in place.

## Verification

- Exact source: `f1d6747cac547ba4e55ea4462d798779a3b124b0`.
- Successful Linux CI: https://github.com/raavan96/tasktracker/actions/runs/34826036667
- Lint, TypeScript production build, 32 unit/action/authentication tests and database regression suites passed.
- PostgreSQL 16 / eight-browser-session workflow passed: delegation/review permissions, archive/restore, local file upload/download, private access, remark edits/history, mention deduplication, future-only schedule edits and pause, image preview access, reporting/export, and 1,000 synthetic task pagination/full export.
- Browser overflow checks passed at 375px and 430px. Existing theme/layout and draft-dismissal regression checks passed. This is Chromium coverage, not a physical iPhone Safari certification.
- Eight simultaneous synthetic search navigations in CI took 991–3,472 ms with 1,000 tasks. These are CI measurements, not a production latency guarantee. A separate local PGlite query-plan check used an index scan and bounded top-N sort (~33 ms); it is not a DigitalOcean benchmark.
- Migration rehearsal restored a production snapshot into a disposable database, applied only migration 008, compared existing-row fingerprints and removed the rehearsal database.
- Production switch preserved all existing records: 12 users/profiles, 4 projects, 7 tasks, 17 memberships, 1 remark, 15 task-history entries, 3 checklist items and 15 notifications at deployment. No real tasks/accounts were modified for QA.
- Authenticated live Search, Reports, task table and task drawer/history loaded successfully. HTTPS login returned 200. App restart count was zero after startup; automation completed successfully and automation/backup/certificate timers were active.
- App memory after verification was approximately 68 MiB, with 279 MiB system memory available. The coordinated switch took 5.2 seconds including backup/migration/startup checks.

## Deployment evidence

- Release directory: `/opt/tasktracker-releases/f1d6747`
- Artifact SHA-256: `abb1c046b64ad975178d4e8f2bcf15753a0e575bbe0309f07f997caab8629c59`
- Applied once: `postgres/008_reporting_collaboration.sql`
- Consistent pre-switch backup: `/var/backups/tasktracker/20260914T090913328833Z`
- Database backup SHA-256: `8a031a301a333b4fa00f21a61ee8e569faa7065595f7b3d7fe1628f5acb5a78a`
- Server deployment record: `/var/backups/tasktracker/release4-deployment.json`
- Previous app: `/opt/tasktracker-releases/db59fea`
- Previous service unit: `/etc/tasktracker-r4-f1d6747.service.previous`

## Rollback and limits

Prefer a forward fix. If an app rollback is necessary, stop the app/automation timer, restore the previous service unit, reload systemd, start the app and resume the automation timer after health checks. Retain schema 008 and its SQL automation function: dropping it would lose remark/history/report/schedule data and reverting the scheduler could disregard pause/end dates. Never restore the pre-switch database over newer team writes without a separate reconciliation plan. The old app cannot expose the new schedule controls.

Task tables/search/reports are paginated; the project board still loads its task cards together. Search matches stored words/phrases, not attachment contents. Reports cannot reconstruct unknown pre-release deadlines or assignees. File previews cover supported raster images/PDF only; browser PDF support varies and Download remains available. Large exports require narrower filters above 10,000 rows. Physical iPhone Safari keyboard/landscape testing and off-server backup copies remain separate follow-ups.
