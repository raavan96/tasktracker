# TaskTracker: user-experience review and deployment plan

Prepared 13 September 2026. Scope: the existing Next.js app, its local PostgreSQL backend, and the DigitalOcean deployment. This is a functional walkthrough and source review, not a penetration test or a physical iPhone Safari certification.

**Release status:** Archive release `91afad7` deployed successfully. Production row counts were preserved; home/login and archive settings were verified, including the 430px layout. Automatic processing completed successfully. The broader UX backlog below remains proposed.

## Completed follow-up — 14 September 2026

Created by labels are live on project cards, project details and task details. Task tables have an optional Created by column; enabling it includes the creator in CSV export. Creator search is supported and stays separate from assignee attribution. Release `2fe1ffb`; no schema changes. The remaining recommendations below are still proposed.

## Recommended direction

Make the app answer three questions quickly: **What needs my attention? Who is responsible? What should I do next?** The strongest next release would improve daily navigation, review clarity, saved views, and recovery from mistakes. Add more reporting and planning features after these interactions are dependable.

The archiving release implements the first improvement. The other recommendations below are a proposed backlog, not a claim that they are already implemented.

## Archive structure implemented in this release

| Action | Result |
|---|---|
| Creator/admin selects **Complete project** | Requires a non-empty project with every task completed/approved. Moves the project to **Archive → Completed projects** immediately. |
| Creator/admin selects **Archive project** | Moves it to **General archive**. A confirmation warns about unfinished tasks and paused recurrence. |
| Task creator/admin selects **Archive task** | Only completed tasks can be archived individually. Details and history are retained. |
| **Archive completed tasks…** in a project | Bulk archives eligible completed tasks older than the selected age, limited to the caller’s permissions. Recurring source tasks are excluded. |
| Automatic task rule | Default: archive non-recurring completed tasks after 30 days. |
| Automatic project rule | Default: general-archive a project after 90 days with all tasks completed. Empty projects and projects containing recurring tasks stay active. It does not label the project as explicitly completed. |
| Restore project | Returns it to active work. Tasks archived individually remain archived. |
| Restore task | Returns the task to active views, keeping its completed status. Restore the parent project first if needed. |
| Admin archive settings | Enable/disable either automatic rule and choose 1–3,650 days. The existing server job runs every 15 minutes. |

Archived work is read-only, including remarks, checklist and attachment writes. People with project visibility retain read access; private projects remain private. Active summaries, My Tasks, All Tasks, and workload exclude archived work. The archive is searchable. Archive/restore actions record actor and time; task events also appear in task history. An archive notification offers Undo, and Restore remains available in the archive.

Important timing details: older completed tasks without a reliable completion timestamp start their retention clock at installation. Restoring an item restarts its retention window, preventing it from being re-archived on the next run. Reminders and recurrence pause while archived; missed recurring dates during that pause are skipped on resumption. No records or attachments are deleted by automatic archiving.

## What was checked

Changes that create or modify data were tested in disposable/synthetic databases. The production walkthrough was read-only. A separate copy of the current production database was used to rehearse the migration; it retained the copied projects, tasks and accounts.

| Area | Evidence and coverage |
|---|---|
| Login and permissions | Eight simultaneous browser sessions against PostgreSQL 16; unit/integration checks for login, expired sessions, throttling, reset and deletion permissions. |
| Projects and membership | Browser creation of a private project and member selection; database checks for privacy, member writes, ownership and cascaded deletion. Edit-menu entry checked in the browser. |
| Task assignment/editing/status | Browser task creation and assignment; edit-form entry; server-action tests cover validation, updates, ownership, assignee scope and deletion. |
| Review | Member submits; admin approves; member cannot approve. Checklist and dependency completion guards tested in the database. Current policy remains admin-only approval. |
| Notes, remarks and history | Project note created through the UI; remark validation/author attribution tested; browser checks verify remarks precede history. |
| Checklist and dependencies | Database checks cover changes, approval blocking, cycles and same-project rules. Not every checklist interaction was manually exercised on a phone. |
| Attachments | Browser upload; matching byte download; outsider denial; download preserved after project archiving. |
| Recurrence and reminders | Database execution and retry checks, unique occurrence/notification keys, monthly date handling; timers inspected on the server. No claim that we waited 30 or 90 real days. |
| Team management | Browser search/edit of job title and department in synthetic data; unit checks for account creation and password reset without emails. Real colleagues’ passwords/roles were not changed. |
| Board/table/export | Desktop and 430px view exclusivity and document-width checks; CSV download; CSV quoting and spreadsheet-formula protection tests. |
| Archive | Browser completion, task/project restore, read-only controls and settings access; database tests for automatic retention, permissions and restore timing. |
| Live interface | Projects/task panel from the previous release; current My Tasks, workload, notifications and team management viewed as admin. Final archive page checked after deployment. |
| Operations | App service, automation/backup/certificate timers and memory inspected. Builds run on GitHub, not on the small server. |

Local checks passed: lint, TypeScript, all 28 existing unit/auth/action tests, and the extended PostgreSQL suite. The Linux build and expanded browser workflow also passed. A successful test run does not establish that every possible combination is bug-free.

Still requires manual acceptance: physical iPhone Safari with keyboard open, slow/interrupted connections, VoiceOver/screen-reader navigation, long real-world descriptions and large rosters, and concurrent edits to the same task. These belong in the next release gates.

## Prioritized improvements

P1 = next release; P2 = after the daily workflow is polished; P3 = optional expansion. Effort is relative: S = focused UI work, M = several connected flows, L = substantial data/permission work.

| Priority / effort | Aspect | Observation or gap | Recommended change and acceptance criterion |
|---|---|---|---|
| P1 / M | Daily dashboard | Projects and counts are useful but require navigation to determine the next action. | Add “Needs my attention”: my overdue tasks, due today, reviews awaiting me, and blocked work. Every row opens the relevant task. |
| P1 / S | Saved views | Board/Table and most filters live in component state and reset on navigation. | Store view/filter/sort in the URL, with a remembered default. Back and reload restore the same selection. |
| P1 / M | Task table | Search/export exist; column sorting and user-selectable columns do not. | Add sortable deadline/priority/assignee columns and multi-select with a preview before bulk changes. Keyboard users can perform the same actions. |
| P1 / M | Review workflow | “Ready for review” works, but approval remains admin-only and actions sit among status buttons. | Add a clear reviewer block with Submit, Approve and Request changes. Require a reason for requested changes. Decide whether task creators may review delegated work; do not expand permissions silently. |
| P1 / S | Action menus | Native disclosure menus vary in behaviour and can stay open while clicking elsewhere. | Use one shared accessible menu with outside-click dismissal, Escape, focus return and consistent separators. Preserve unsaved-edit protection. |
| P1 / M | Forms and drafts | Dialog-wide dirty tracking treats any changed control as unsaved, including some immediately saved controls. “Add teammate” can also leave a partially filled task form. | Track actual unsaved form values, preserve task drafts during member selection, clear draft state after a confirmed save. No false discard prompt after an already-saved checklist action. |
| P1 / M | Notifications | There is a mark-all action; no individual read/snooze controls. Links are labelled “View Project” although they open a task. | Label links “Open task”; add mark-one-read, unread filter and grouped deadline reminders. Show action errors and refresh the unread badge reliably. |
| P1 / S | Workload | Counts are plain text and cannot open the underlying tasks. | Make each count link to an assignee/status-filtered list; add sort by pending/overdue. Show active workload separately from completed work over a chosen period. |
| P1 / M | Member lifecycle | Role changes are prominent one-click actions; deletion is available, but deactivation is absent. | Add deactivation/reactivation, ownership/reassignment preview and explicit role-change confirmation. A deactivated member cannot sign in; historical authorship survives. |
| P1 / M | Errors and recovery | Some actions provide helpful errors; role changes and some server list reads have weaker failure handling. | Standardize pending, success, retry and error feedback; prevent stuck buttons after network exceptions. Never report an empty list when the fetch actually failed. |
| P1 / M | Mobile and accessibility | Responsive checks pass, but broad tables and dialogs still need real-device validation. | Test 375/430px, landscape and Safari keyboard. Keep save controls reachable, field errors associated, focus visible, and menus labelled with the relevant task/person. |
| P1 / M | Operational reliability | Local backups are scheduled; regular off-server copies and restore drills are not automated. | Add encrypted off-server backup copies, a restore drill and alerts for failed backup/job/certificate renewal. Keep an explicit recovery runbook. |
| P2 / M | Search | Project listing lacks its own search; searches do not form one workspace-wide entry point. | Add global search across accessible projects/tasks/notes, with an explicit Include archived switch and permission-filtered results. |
| P2 / M | Remarks | Plain text and links work, but collaboration is limited. | Add mentions with in-app notifications, edit-own remarks with an “edited” marker, and optional reply threads. Keep chronological context and history. |
| P2 / M | Attachments | Upload/download work, but users cannot preview or manage versions in the UI. | Add safe image/PDF preview, progress, remove/replace controls with confirmation, and storage usage. Retain access checks on every download. |
| P2 / M | Recurrence | Daily/weekly/monthly repeat exists; users cannot see a complete schedule preview. | Show next run, pause/resume, end date and “edit this occurrence / future occurrences.” Test month-end dates and changes while archived. |
| P2 / M | Dependencies/checklists | Basic checks work; blocked users must inspect individual tasks for the reason. | Display “Waiting for…” on cards; add checklist reordering and progress. Explain the exact dependency/checklist that prevents approval. |
| P2 / M | Reports | Workload is a snapshot; archived completions drop out of active counts. | Add date-range completion/overdue trends that include historical archived completions, clearly labelled; export the filtered dataset. |
| P2 / M | Archive usability | Basic archive, restore and settings are implemented. | Add a preview of the next automatic run, per-item retention exceptions, and project-level archive activity in the UI. Explicit completion and automatic archive must remain distinguishable. |
| P2 / M | Performance | Several pages fetch full collections and nested data. | Add server pagination and scoped queries as records grow; measure authenticated navigation, not only anonymous curl response time. Target useful feedback immediately and measure p95 task-list latency. |
| P2 / M | Concurrent work | Standard refreshes can leave one user looking at stale task data. | Add a last-updated/version check to prevent silent overwrite, then modest polling or server events. Show “Updated by another teammate” with a refresh option. |
| P3 / M | Reusable planning | Repetitive project/task creation is manual beyond recurrence. | Add project templates, duplicate task/project, and reusable checklists with previewed assignees and due dates. |
| P3 / L | Calendar and capacity | Task counts do not describe effort or availability. | Add calendar view and optional effort estimates/capacity only if the team will maintain them. Avoid treating raw task count as individual productivity. |
| P3 / M | Phone convenience | Browser access works, but installation/offline affordances are absent. | Add an installable PWA and cached shell. Keep edits online initially; offline sync needs conflict resolution before enabling it. |

## Deployment plan

### Release 1 — Archive and completion (this change)

1. Build and test the exact Git commit on Linux using synthetic PostgreSQL data.
2. Restore a production snapshot into a separate database and apply `postgres/006_archiving.sql` there. Check row preservation and run the job.
3. Take a fresh production backup; stage a separate verified app release. Preserve `/etc/tasktracker-local.env`, live PostgreSQL data and attachments.
4. Pause the application and automation briefly, apply the additive migration transactionally, then start the verified app. Re-enable automation and verify one execution.
5. Check home/login, Active projects, both archive sections, admin settings and service health. No real project is completed or archived merely to demonstrate the feature.
6. Retain the previous app and service unit. If the new app cannot start, disable automatic archive rules before restoring the previous app. Keep the new database columns/history; do not revert the whole database and lose user writes.

### Release 2 — Daily interaction quality

Bundle P1 dashboard, saved views, shared menus, drafts, error feedback, individual notifications and clickable workload counts. Stage first; have an admin and a member run a short acceptance script on desktop and iPhone. Keep the first bundle small enough to identify regressions. Suggested acceptance: create/assign → member update → submit → admin approve → archive/restore with no lost draft, incorrect count or unexplained disabled action.

### Release 3 — People and review controls

Add member deactivation, reassignment previews and explicit review roles. Agree on creator-review/self-approval rules before schema changes. Test creator, assignee, reviewer, admin, outsider and deactivated user separately. Roll out behind an admin setting where appropriate.

### Release 4 — Reporting, collaboration and scale

Add date-range reports, global search, mentions, attachment preview and recurrence controls in separate increments. Introduce pagination and conflict detection before adding real-time updates. Re-run eight-session tests against realistic record counts and files. Monitor memory, query latency and restart counts on the constrained server.

### Release 5 — Optional planning features

Choose templates, calendar/capacity or PWA based on actual team usage rather than shipping all at once. Each feature needs a short success criterion, an isolated acceptance test and an independently reversible deployment.

### Gates for every release

- Exact-commit lint/type/build and database/browser checks pass.
- Admin/member access and private-project isolation pass.
- Active, completed and archived states produce correct counts and permissions.
- iPhone Safari keyboard, portrait/landscape and reduced-motion checks pass for changed flows.
- Backup and rollback are prepared; new writes are preserved during rollback.
- After deployment, inspect app/job errors and ask the team to try the changed workflow before combining another large release.

## First decisions for the next UX release

1. Should task creators be allowed to approve work delegated to someone else, or should a separate reviewer/admin always approve?
2. Which view should members land on: My Tasks or the project dashboard?
3. Should completed reporting mean active-project completions only, or all completions within a chosen date range? Recommended: the latter for reports, with active counts kept separate.
