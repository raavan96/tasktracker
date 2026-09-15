# TaskTracker releases A and B

## Release A — reliable, responsive saves

- Remarks return their committed record in the save response. The composer updates immediately after confirmation, without a project re-render and second remarks request.
- New remark retries reuse a UUID protected by the existing primary key. Edits retain their version checks and recognize a replay of the same committed edit.
- Failed confirmation keeps the draft. The composer shows Saving… and Saved, and prevents changes to the submitted draft while it is pending.
- Task mutations invalidate named pages instead of the entire dashboard layout. Table details and rows refresh after edits.
- Server logs contain save duration without remark content or identity. Browser performance entries record confirmed-save duration.

## Release B — leaner loading and consistent data

- Only search typing is debounced. Sorting, filters and pagination start their requests immediately.
- Table filter rosters are reused in the mounted view, refreshed on window focus, and every task query still enforces current database permissions.
- Details and Updates fetch their relevant extras separately. Remarks load when Updates is opened. Existing drafts remain mounted when switching sections; recurring schedule loading is deferred until Details.
- Project boards initially fetch active tasks. Archived work and notes load on demand. Direct table routes avoid loading the full board; opening a row loads that task. Dependency options remain available independently.
- Project task/note counts are loaded separately, so unloaded sections do not appear empty. Read failures show an error and retry rather than silently presenting missing data as an empty project.
- Notifications use pages of 50, with global unread counts and a server-side unread filter.
- Awaiting-review tasks consistently use the review queue instead of overdue/today work counts, across dashboard summaries and matching task lists.

## Validation

- Local lint and TypeScript checks passed.
- All 35 unit tests passed.
- Database regression passed for existing permissions, approvals, archive, recurrence, planning, reports and the new remark retry behavior.
- New database tests cover duplicate creation, duplicate edit retries, mention/history deduplication, concurrent-edit conflicts, ownership, private-project access and archived work.
- Initial Linux browser run 34946189715 passed against PostgreSQL 16, including existing desktop/mobile-width workflows, 1,000-task pagination/export, a committed save with a deliberately lost response, and eight concurrent users.
- Initial CI save measurements: 30 saves; median 69 ms, p95 85 ms, maximum 247 ms. Eight concurrent confirmed saves: 177–291 ms. These measure synthetic browser-to-server interactions in CI, not the live DigitalOcean server or a physical iPhone connection. There is no matched old-build latency baseline, so no percentage speedup is claimed.
- Final CI run 34946497586 for `7ccd9c7b5e560c68edcd1716551ce46ef4efd16b` passed every build and test step. It additionally verified that 30 saves made exactly 30 POST requests, without a follow-up remarks or project refresh request. Final measurements: median 82 ms, p95/max 93 ms; eight concurrent saves 224–318 ms. The same CI-only limitations apply.

## Deployment

No database migration is required. Existing data, user accounts and approval rules remain compatible with the preceding release. Build the standalone artifact on Linux, verify its digest, back up the database and files, switch the systemd working directory to the verified release and check health and authenticated views. Preserve the previous artifact and unit file for application rollback; do not roll back the database over new user activity.

Deployed successfully on 15 September 2026 at approximately 08:26 UTC (13:56 IST).

- Live release: `7ccd9c7b5e560c68edcd1716551ce46ef4efd16b` at `/opt/tasktracker-releases/7ccd9c7`.
- Verified artifact SHA-256: `e76e6fe75e0d531a8ff16f1949ff3ea19f0f2e09d0a19fa4c23b33555106a3ac`.
- Backup: `/var/backups/tasktracker/20260915T082608722859Z`.
- Verified database backup SHA-256: `31e03da44c62be680a953227b069d4947e600694db8237828659f38c5426da07`.
- Previous application: `/opt/tasktracker-releases/8478fec`; previous service unit: `/etc/tasktracker-release-ab-7ccd9c7.service.previous`.
- Server deployment record: `/var/backups/tasktracker/release-ab-deployment.json`.
- Deployment script completed in 5.2 seconds, including backup, health checks and automation restart.
- Pre-switch inventory: 12 users, 4 projects, 8 tasks, 17 memberships and 2 remarks. No schema migration or test-data insertion was performed on production.
- Public home/login health checks and automation run succeeded. Authenticated live checks confirmed the project table, opening task details, dependency options, Updates/history and notification pagination controls.
- Post-switch service was active, with zero automatic restarts, about 71 MiB current service memory and no recent error-priority journal entries.

[Successful final CI run](https://github.com/raavan96/tasktracker/actions/runs/34946497586).

## Limits

Physical iPhone Safari and mobile-network latency are not verified by the Chromium viewport tests. The active board still loads its active tasks as a collection; table pagination is the preferred view for very large projects. A full offline outbox, persistent browser draft storage and further interface simplification are separate work.
