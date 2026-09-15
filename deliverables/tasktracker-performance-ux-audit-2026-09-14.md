# TaskTracker performance and usability audit

14 September 2026 · Live application: https://168.144.155.51 · Code reviewed: 8478fec (local documentation HEAD 4c038e2)

## Assessment

Fix the save experience before adding more features. The code performs unnecessary follow-up reads and broad page invalidation, while the remark composer gives weak feedback and has an incorrect draft-recovery message. These are credible contributors to the reported slowness when saving updates. Their individual contribution has not yet been timed in an authenticated save.

The server was healthy during the sampled period. A larger server is not the first change justified by this evidence. Keep the current setup while measuring and reducing application work; the small memory budget still warrants monitoring during builds and concurrent use.

## Scope and limits

- Read-only live inspection of Projects, a project board, task Details and Updates, All Tasks, Reports, Templates, Archive and Team Management using the existing admin session.
- Source review of remark/task/checklist save paths, task loading, filters, summaries, notifications, workload and database access.
- Read-only server health and public login timing checks.
- No production tasks, remarks, memberships or settings were changed. No new deployment occurred.
- This is not a full mutation regression, permissions audit, physical iPhone Safari test or controlled load test. No end-to-end Save percentile or visual contrast score is claimed. Calendar, search and notifications were reviewed in code rather than exhaustively exercised live.

## Measured baseline

Server snapshot at approximately 14:07 UTC:

| Check | Result | Interpretation |
|---|---|---|
| Load average | 0.00 / 0.00 / 0.00 | No sustained CPU pressure at that moment |
| CPU samples | 99–100% idle, 0% I/O wait | No sampled resource bottleneck |
| RAM | 764 MiB total, 272 MiB available | Limited capacity, but available memory |
| Swap | None | Little protection against a memory spike |
| App memory | About 75 MiB current, 77 MiB peak | Within current app service limit |
| App restarts | 0 | No restart loop observed |
| App error journal | No error-priority entries in previous two hours | Does not rule out handled application errors |
| Local login response | 25.8 ms first byte, 26.3 ms total | Public endpoint only |
| HTTPS login from server | 38.2 ms first byte, 41.7 ms total | Does not include the user's mobile network |

## Confirmed findings and proposed fixes

### 1. High priority: saving a remark waits for a second request

`src/components/TaskDiscussion.tsx:12` awaits `saveRemark`, clears the composer, then awaits `listRemarks` before releasing the busy state. `src/app/dashboard/discussion/actions.ts:14` also revalidates the project route. The server returns only an error field, so the client cannot directly insert the committed remark into its list.

**Change:** Return the authorized, committed remark with its author and version from the save action. Reconcile that row locally and update its count. Refresh only affected data as needed. Preserve authorization, mention validation and concurrent-edit checks. Avoid turning a failed refresh into an apparent failed save.

**Feedback:** Show “Saving…” immediately, then “Saved”; announce the result accessibly. A pending row may be shown, but must remain visibly pending until the server confirms it.

Next.js supports returning updated data and UI in the same action round trip; an additional client read is an application choice, not a requirement. [Official Next.js mutation guide](https://nextjs.org/docs/app/getting-started/mutating-data).

### 2. High priority: draft recovery message can be wrong

In the same submit handler, the text is cleared before the follow-up read. If that read fails, the catch message says “Your draft is kept” although it has already been cleared. The write may have succeeded, leaving the user unsure whether to retry.

**Change:** Separate save failure from refresh failure. Retain the submitted text until confirmation and show a distinct “Saved, but the timeline could not refresh” state when appropriate. Add a request identifier backed by server-side uniqueness so retrying an uncertain new remark cannot create duplicates. Test response loss after commit and concurrent edits.

### 3. Medium priority: task mutations invalidate a broad layout

`src/app/dashboard/tasks/actions.ts:7–10` revalidates the project, My Tasks and the dashboard layout. The project route reloads members, all project tasks, all notes, workspace profiles and review settings.

**Change:** Instrument write, route-render and response time separately. Return the changed task and reconcile the open panel/card; invalidate the smallest data scope that keeps summaries and permissions correct. Keep count consistency and server authority. Do not simply remove all refreshes.

### 4. Medium priority: hidden task sections still load data

`ProjectView.tsx:440–475` hides Details/Updates with HTML `hidden`; both remain mounted. TaskDiscussion loads remarks even on Details. TaskExtras loads checklist, dependencies, attachments, history and reviews together. Its hidden Details section also mounts TaskSchedule.

**Change:** Load the visible section first. Fetch history/reviews when Updates is opened and recurrence settings when requested. Keep already loaded sections and drafts available when switching tabs. Do not unmount a dirty composer without preserving its state.

### 5. Medium priority: task table has a fixed delay and repeated roster reads

`src/components/TaskTable.tsx:24` waits 180 ms before every fetch, including initial display, sorting and paging. `src/lib/workspace-data.ts:8–28` reads people and projects again for each table request.

**Change:** Debounce only text entry. Fetch immediately for discrete controls and pagination. Keep prior rows visible with a small loading indicator. Reuse authorized filter options within the view and refresh them when membership changes.

### 6. Medium priority: dashboard and task-list count rules disagree

`src/lib/task-presentation.ts:24–25` includes review-stage tasks in overdue/today counts. `src/lib/workspace-data.ts:16` excludes them. A task awaiting review can therefore be included in a summary but absent after clicking through.

**Change:** Define one business rule and use it everywhere. Recommended distinction: overdue work versus overdue review, with the latter still visible to its eligible reviewer. Test counts against clicked results, including archived work and India-time midnight boundaries. No live example was reproduced because the observed dashboard had zero awaiting-review tasks.

### 7. Medium priority: growing data will amplify loading costs

The project page loads every task, including archived tasks, and every note. Table mode separately fetches a paginated list. Notifications have no query limit. These are scaling concerns, not proof of the current seven-task slowdown.

**Change:** Load active board data and aggregate counts separately; fetch archived work and notes on demand. Paginate notifications. Select fields needed by each view. Measure query plans before adding indexes or increasing the four-connection pool on this server.

### 8. Medium priority: some read failures can look like empty data

The project page explicitly handles a profiles failure but maps missing tasks, notes and memberships to empty arrays without first handling their errors.

**Change:** Show a section-level failure and Retry action instead of “no tasks” when a query fails. Preserve the last successful view during transient failures.

## Items to simplify, not remove blindly

| Area | Observed friction | Suggested treatment |
|---|---|---|
| Task review | Repeated policy paragraph competes with task content | Short eligible action and status; put policy explanation behind an information control |
| Task Details | Empty checklist, dependencies and attachments all occupy space | Compact “Add checklist / dependency / file” controls; expand populated sections |
| Updates | Empty Review decisions heading and historical implementation wording | Hide empty decision section; replace migration-era wording with useful history guidance |
| Team Management | Edit, Reset password, Make Admin and Deactivate repeat on each row | Keep Edit prominent; put account/role actions in a labeled member menu, with deactivation separated |
| Review policy | Workspace-wide policy sits above routine member management | Move to an expandable administration settings area |
| Reports | Technical completion-event explanations dominate an empty report | Lead with useful results; put counting rules in “How this report is calculated” |
| Task filters | Search plus five selects, reset, export and a column checkbox | Keep search and common filters visible; group secondary filters and column controls |
| Archive | Project archived toggle and global Archive can feel duplicative | Keep project-scoped access, but label its scope clearly; global Archive remains the cross-project destination |
| Header | Password and sign-out controls compete with everyday navigation | Group account actions under the profile menu; keep search and notifications convenient |
| Dashboard | Team summary counts appear above personal “No urgent actions” | Explicitly label “Team overview” and “My attention queue” |

Source search found no callers for the legacy `addComment` export or `MyTasksClient` component outside their definitions. Treat them as removal candidates after build/import verification, not as a proven major runtime saving. WorkspaceLayout also renders three navigation instances for responsive layouts; inspect whether the permanently hidden variant can be eliminated without changing responsive behavior.

No feature is classified as useless solely because it is currently empty. Templates, history, attachments and archive are valuable once the corresponding workflow is used.

## Highest-value additions

1. **Reliable draft recovery:** retain task-update drafts across accidental navigation, with explicit discard and user/task scoping. Avoid retaining sensitive drafts indefinitely on shared devices.
2. **Saved views:** one-click filters such as “Delegated by me”, “Waiting for my review”, “Unassigned” and “No deadline”; optionally pin useful projects.
3. **Safe bulk edits:** assign, change deadline or archive selected eligible tasks; show skipped items and permission reasons. Never bypass the shared-assignee approval policy.
4. **Stale-work signals:** show “No update for X days” and a blocker reason so managers can identify work needing attention without opening every card.
5. **Notification controls:** unread/mentions/review filters, grouping by task and user-controlled in-app reminder frequency. Existing reminders do not need to be replaced with email.
6. **Capacity-aware workload:** optional effort estimates and availability. Raw task counts alone cannot distinguish one large assignment from several small ones.

Defer chat, complex Gantt editing, heavy animation libraries, AI summaries and always-on live polling until a clear team need exists. The app already has multi-assignment, review, calendar, templates, history, recurrence, attachments and export; making these dependable has more immediate value.

## UI direction

- Keep identical geometry and interaction in light and dark themes; vary palette through shared tokens.
- Preserve title, assignees, deadline and current status as the strongest task information. Use restrained priority accents.
- Use one primary action per panel, consistent status terms (“To do”, “In progress”, “Ready for review”, “Completed”) and clear save feedback.
- Prefer short opacity/transform transitions and respect reduced motion. Do not animate expensive layout properties on large collections without profiling.
- On iPhone, use a compact filter sheet, generous tap targets, a reachable composer action and keyboard-safe scrolling. Validate on the actual iPhone 15 Pro Max in Safari, including both themes and landscape.

## Proposed delivery sequence

### A — Save reliability and responsiveness

Instrument save requests; fix draft/error handling; return saved rows; add idempotent retries; narrow refreshes; add pending/success states. Measure baseline before changing the implementation.

Acceptance: no lost draft on failure; no duplicate on retry after response loss; versions and permissions remain enforced; feedback appears immediately. Record median/p95 click-to-confirmed-save over at least 30 saves on a disposable environment, on desktop and mobile network conditions, plus eight concurrent users. Proposed target: p95 under one second on a stable connection, assessed against measured baseline rather than promised in advance.

### B — Loading and consistency

Lazy-load panel sections, remove non-search debounce, avoid duplicate table/board data, paginate notifications, align summary rules and add explicit read-error states.

Acceptance: count equals matching list; no extra hidden-section requests on initial open; no artificial delay for paging/sorting; filters retain correct private-project visibility. Check growing fixtures, not just the current small dataset.

### C — UI simplification

Consolidate member/account actions, simplify empty sections and report copy, improve filter layout and label personal/team scope. Keep the existing navigation order unless the user approves a change.

Acceptance: desktop and iPhone Safari walkthroughs; keyboard navigation, focus return, unsaved-change protection, light/dark parity and reduced-motion checks.

### D — Targeted functionality

Add saved views and stale-work indicators first, then safe bulk actions and notification preferences. Evaluate capacity estimates with the team before building them.

### Deployment safeguards

Use separate reviewable releases for A/B and C/D. Build on Linux outside the constrained live server. Back up database and attachments before schema changes; use additive migrations where possible. Rehearse on a disposable database and test creator/admin/assignee/nonmember cases, including no self-approval and private projects. Deploy the verified artifact, check health/login/read/save on a designated test record, and monitor latency, memory and errors. Retain the prior artifact and compatible schema for rollback; do not restore an old database over new team writes.

No implementation or deployment has been performed as part of this audit.
