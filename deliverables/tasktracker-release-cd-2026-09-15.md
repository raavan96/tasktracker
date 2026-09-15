# TaskTracker releases C and D

## Release C — simpler everyday controls

- Account actions are grouped under My account; password and sign-out actions have clear labels.
- Team management keeps Edit details prominent, with role/password actions in a member menu and lifecycle actions separated. Workspace review policy is expandable.
- Task approval rules, empty checklist/dependency/attachment sections and report calculation notes are expandable. Populated task sections remain visible by default, and empty review-decision headings are omitted.
- Dashboard sections distinguish Team overview from My attention queue.
- Shared assignee names retain a readable minimum column width on phones, within the horizontally scrollable table.
- Secondary table filters and column options are grouped under More filters & columns. Existing sidebar order, themes and lightweight transitions remain in place.

## Release D — focused workflow improvements

- Private saved task views persist across devices. Each user can save up to 20 named combinations of supported filters and remove them later. Saved filters never bypass current project visibility.
- Quick views include Delegated by me, My reviews and No recent updates. My reviews excludes self-approval and requires current work access.
- Task tables show a stale-work label after seven India-calendar days without a task change, task-history event or remark. Completed work is excluded; this is an advisory signal rather than an automatic status change.
- Bulk controls select eligible tasks on the current page. Users preview deadline changes, replacement assignee groups or completed-task archiving, then confirm. The server rechecks ownership/admin permission, project membership, archive/review state and task versions. Results identify successful and skipped rows. Bulk approval and deletion are intentionally unavailable.
- Notification preferences control future in-app assignment, mention and review alerts. Deadline reminders can be daily, every three days, weekly or off, per task. Defaults preserve existing daily reminders and enabled alerts; existing notifications are retained.

## Validation and rollout

- 37 unit tests passed, including saved-filter input validation and India-date stale boundaries.
- Local lint and TypeScript checks passed.
- Database tests cover saved-view/settings isolation; bulk preview, partial success, stale-version retries, immutable submitted/completed work, creator/admin restrictions, assignment membership and archive rules; reminder opt-out and weekly suppression.
- Migration 011 was rehearsed against a private copy of the live PostgreSQL database. All pre-existing records across 23 tables were unchanged; the temporary database was removed. Rehearsal evidence remains privately on the server at `/var/lib/pgsql/tasktracker-cd-rehearsal/result.json`.
- The Linux workflow additionally tests saved views across users and reloads, bulk preview/confirmation, persisted preferences, quick views, account menus and 375/430/1280-pixel layouts. It retains the prior workflow, approval, attachment, archive, export, eight-session and save-retry regression checks.

## Migration and rollback

`011_workspace_preferences.sql` adds two tables protected by row-level security, a notification-preference trigger and its lookup index. It does not rewrite existing tasks, users or notifications. New preferences are opt-in; no existing member is muted by the migration.

Deployment took a fresh consistent backup, applied the verified additive migration, checked existing-record fingerprints, switched to the tested standalone artifact and restarted automation. The prior app remains compatible with the new tables; an application rollback keeps the schema and user preferences, avoiding data loss.

Physical iPhone Safari/network performance is not established by Chromium viewport tests. Capacity estimates, persistent offline drafts and additional UI redesign remain later work.

## Live deployment evidence — 15 September 2026

- Deployed commit: `b1ff6591628061b4f11ed2f5ba56e8f20dbd1dc8`.
- [Successful Linux build and complete regression run](https://github.com/raavan96/tasktracker/actions/runs/34950538720).
- Verified release archive SHA-256: `977a6b6267c79d62a8cc935f93aa647855b6f124e3f686c2bbe867a0f7a19f4c`.
- Live release directory: `/opt/tasktracker-releases/b1ff659`.
- Consistent pre-switch backup: `/var/backups/tasktracker/20260915T091157132774Z`.
- Database backup SHA-256: `06839879c0899b9f547cd4cda69849f4f831550e99800b4f57c77f86552e2246`.
- Switch and deployment checks completed in 6.1 seconds. Migration fingerprints confirmed all existing records unchanged, including 12 users, 4 projects, 8 tasks, 2 remarks, 22 history entries and 22 notifications.
- App, PostgreSQL, automation, backup and certificate-renewal timers are active. App restart count is zero since deployment. Root and login returned HTTPS 200 both from the server and externally.
- CI confirmed-save benchmark: 30 samples, median 80 ms, p95 93 ms; eight concurrent confirmed saves ranged from 237–313 ms. These are synthetic Linux CI results, not measurements of the production server or a phone network.
- Phone previews at 375/430 pixels and desktop at 1280 pixels passed overflow checks; shared-assignee row wrapping was visually inspected and corrected.
- Signed-in production UI verification remains pending: the previously supplied credential was rejected, and the user was asked to sign in through the browser. No credentials, user preferences or live tasks were changed for the smoke checks.
- Deployment evidence is also stored privately at `/var/backups/tasktracker/release-cd-deployment.json`. The previous app unit is `/etc/tasktracker-release-cd-b1ff659.service.previous`; rollback preserves the additive schema and user work.

