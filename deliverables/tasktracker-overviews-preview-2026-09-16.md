# Dashboard overviews — preview only

Production is unchanged. User requested visual review before deployment.

Projects: active, needs attention (active project with an unarchived blocked/overdue task), ready to complete (non-empty active project with every task done), explicitly completed archived projects, and general archived projects. Attention/ready are subsets of active projects. Clicking the subset cards filters the project collection. Completion still requires creator/admin action.

All Tasks and My Tasks: overdue, due today, in progress, awaiting review, completed. A single aggregate query counts the complete RLS-visible active scope, with the current user's assignment restriction on My Tasks. Card links retain that scope. These overviews summarize the page's base scope, independently of table search/filter selections.

Archive: general archived projects, completed projects, and tasks in the general archive (including tasks hidden by an archived parent; excludes tasks in completed projects). Counts are independent of archive search. Cards link to the matching section.

Workload: pending, overdue, awaiting review, completed, unassigned pending. Summary counts unique tasks; person rows include each shared assignment.

Preview gallery: `http://127.0.0.1:3122/index.html`. Real rendered screenshots using synthetic CI data; gallery controls switch page/theme/width, but screenshot controls are not interactive. Twenty screenshots cover five pages, two themes, and 430px/1440px widths.

Initial verified build `8a0174fcd9c2740da7ad74ddda0347d1cf1aedf4`, CI https://github.com/raavan96/tasktracker/actions/runs/35073467431 passed. Includes database comparisons of personal/team task summary counts and destinations, full browser workflows, contrast and theme parity. Screenshot capture subsequently adjusted to await theme transition completion.

Final verified preview: `e07a3de7ea36fe4fa13f141e0344bcde6f9e2b60`, https://github.com/raavan96/tasktracker/actions/runs/35074464651 — all checks passed. Gallery refreshed with final screenshots. Not deployed.

Compact card revision: `44f4702937793776dba2f1bab0e22b259baa0acd`. Reduced vertical padding and count size on desktop/mobile; labels and destinations retained. CI https://github.com/raavan96/tasktracker/actions/runs/35077978996 passed. Gallery refreshed; production unchanged.

## Approved and deployed

The user approved deployment after the compact-card preview. Deployed the exact tested artifact `44f4702937793776dba2f1bab0e22b259baa0acd` to `/opt/tasktracker-releases/44f4702`.

- Artifact SHA256: `f1a73f7144a34e8dfced2774b0e5e100fdc857a4362eb604c13cee9c26dc1bb8`.
- Backup: `/var/backups/tasktracker/20260916T092412345152Z`, SHA256 `964a7d48c8cb5783a918d043f6e51d4a242d958cac85d43d551787c5d6482472`.
- Switch: 5.4 seconds; no schema migration, existing records preserved.
- Public HTTPS login returned 200, and compiled compact-card CSS verified.
- App, automation and email timers active.
- Server evidence: `/var/backups/tasktracker/release-overviews-deployment.json`.
- Rollback unit: `/etc/tasktracker-release-overviews-44f4702.service.previous`.
