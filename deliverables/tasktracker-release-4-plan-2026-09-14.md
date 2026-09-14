# Release 4 — Reporting, collaboration and scale

Prepared against live Release 3 (`db59fea`) and repository HEAD `400c684` on 14 September 2026. Implemented and deployed on 14 September 2026. See `tasktracker-release-4-2026-09-14.md` for delivered behavior, verification, operational evidence and remaining limits. The following sections retain the original specification. The source of scope is the Release 4 section of `tasktracker-ux-audit-and-deployment-plan-2026-09-13.md`.

## User experience

Release 4 should help the team find work, understand progress over time, discuss a specific assignment and manage repeated work. Keep the existing light/dark design and task drawer. Use the local PostgreSQL database and DigitalOcean server; no email provider, external search service or realtime infrastructure is required.

## 4A — Query and editing safeguards

Ship this foundation before introducing new full-workspace views.

- Add database-side filtering, stable sorting and pagination to large task lists, search results and report detail rows. Start with 25 rows per page and a maximum of 100. Sort ties by ID. Reset pagination when filters change and retain filters in the URL.
- Counts and CSV exports must use the entire permission-filtered result, not only the visible page. Explain any export limit explicitly; never silently truncate a report.
- Load project task remarks/history when the drawer opens rather than embedding every remark in the board payload. Bound timeline requests and provide Load more.
- Use the existing task `review_version` for compare-and-update writes, extending conflict protection from review actions to normal task editing and quick status changes. Add equivalent version checks to project and note editing where necessary.
- On a conflict, retain the user's draft and show “This item was updated by another teammate.” Offer to load the latest version after confirming draft discard. Never silently overwrite the newer record or automatically merge conflicting fields.
- A concurrent edit, archive or member deactivation must still pass existing permission, activity and review guards at commit time.
- Do not add realtime updates in this release. Measure authenticated queries and navigation first.

Acceptance: two people editing the same task cannot silently overwrite each other; paginated results have no duplicate/missing items on a fixed dataset; counts and export agree; search/list requests remain bounded; existing board and archive behavior stays intact.

## 4B — Workspace search and reports

### Global search

Add Search to the workspace navigation/header, with results grouped into Projects, Tasks, Project notes and Task remarks. Search titles and plain-text content, showing the containing project, result type and a short excerpt. Task results open their drawer; note/remark results link to the relevant context.

Default to active work, with an explicit Include archived switch and an archived label on results. Support Enter to open a result and Escape to close the search interface. Search runs on the server, is parameterized and paginated, and never fetches inaccessible work into the browser.

Permissions apply to result rows, snippets, counts and autocomplete. Active-account checks and current private-project membership remain authoritative. Search must not leak even the title or existence of inaccessible projects. Initial search targets text already stored in PostgreSQL, not the contents of attached files.

### Date-range reporting

Add a Reports page while retaining Workload as the current active-work snapshot.

Defaults:

- Date range: last 30 calendar days, interpreted in Asia/Kolkata. Offer Last 7 days, This month and custom From/To dates.
- Filters: project and assignee; retain them in the URL.
- Include archived completions in historical reports by default, visibly labelled. Members see only work they can currently access; admins can see the whole workspace.
- Show distinct tasks completed, completion activity over time, on-time/late completion where the due date at completion is known, and a task-level drilldown/export.
- Label current overdue/pending counts separately as “As of now.” Do not present today's overdue tasks as a reconstructed historical overdue trend.

Historical accuracy:

Record an immutable completion event when an approval succeeds, including task/project references, assignee and deadline at approval, approval time and reviewer. A reopened task may have multiple completion events: label activity counts as events, and deduplicate task counts within the selected range. Show reopens separately where the data supports it.

Existing review records do not reliably preserve assignee/deadline at approval. Backfilled records must identify their source and unknown fields; do not substitute today's assignee/deadline and call them historical facts. Unknown historical deadlines are excluded from on-time percentages with the excluded count shown. If an older completion timestamp was initialized during a migration, label it as estimated rather than inventing precision. Archived data remains reportable; permanent deletion follows the app's deletion policy and must not leave an unprotected report copy of a private task.

Acceptance: archived completed tasks remain discoverable; India date boundaries are correct; reopen/reapprove counts follow the displayed definition; exports match the selected filters; privacy holds for all aggregates as well as drilldown rows.

## 4C — Collaboration and attachments

### Mentions and editable remarks

- Add an @ picker to task remarks. Only active teammates who can access that project are selectable; mentioning someone never grants project access.
- Store mention IDs separately from display text so duplicate names and later name changes remain unambiguous.
- Notify a mentioned member in-app with a direct task link. No email. Exclude self-mentions and deduplicate repeated mentions/retries.
- Allow authors to edit their own remarks with an Edited indicator, timestamp and version check. Retain the original/edited history according to current access rules.
- Editing a remark notifies only newly mentioned recipients. Removing a mention does not rewrite already delivered history.
- Reject comment/mention writes on archived work and from inactive accounts. Recheck access when a notification or mentioned task is opened.
- Reply threads are a later extension; keep chronological remarks clear in this increment.

### Attachment previews

- Preview supported raster images and PDFs from the task drawer, with filename, size, uploader and Download fallback.
- Check identity/project access on every request, including archived tasks. Keep responses private and non-cacheable.
- Determine preview eligibility from file content as well as extension. HTML, SVG, scripts and unrecognized files remain downloads; never render arbitrary uploads as app-origin HTML.
- Isolate previews with appropriate browser restrictions. Provide a download fallback if the browser cannot display a PDF.
- Retain the current 10 MB limit. Add upload progress/pending feedback and prevent duplicate submissions.
- File versioning/replacement and richer document previews are outside the first increment; they need separate retention and backup semantics.

Acceptance: outsider/inactive requests cannot preview files; invalid file types cannot execute page content; keyboard users can open/close previews; mobile controls remain reachable; mention notifications do not duplicate or widen access.

## 4D — Recurrence controls

Add an explicit schedule area showing the next run, frequency, end date and next five planned dates, together with pause/resume controls.

- Distinguish “Edit this task” from “Edit future occurrences.” Changes to future work do not rewrite existing tasks, their approvals or Created by labels.
- Separate schedule/template metadata from an individual task's reviewed content where needed. Editing future schedules must not bypass the approval rules for existing work.
- Creator/admin controls require current project access. Inactive creators/assignees and archived parents continue to hold recurrence. Show the reason a schedule is held instead of displaying it as running.
- Resuming skips missed dates; it does not create a backlog. Display the next eligible date before confirmation.
- An end date is inclusive in Asia/Kolkata and prevents occurrences after that date. Month-end scheduling retains the original anchor day where possible.
- Preserve unique occurrence keys and the one-runner lock. Retries and concurrent timer executions cannot duplicate assignments.
- History records pause/resume and future schedule changes. Existing reminder/archive behavior remains compatible.

Acceptance: daily/weekly/month-end cases, end-date boundaries, pause/resume, archive/restore, inactive-account holds, concurrent runners and changes to future occurrences all pass without changing existing task history.

## Delivery and deployment

Implement the four increments in dependency order. Test each before combining the release. No new infrastructure or larger server is assumed; evidence from load tests determines whether a feature needs adjustment.

1. Read the bundled Next.js documentation for changed routes/actions. Add reviewed, additive PostgreSQL migrations with explicit privileges and compatible indexes. Do not reuse an initialization script on production.
2. Run lint, TypeScript, meaningful unit tests, database permission/conflict tests and the existing eight-session regression workflow. Add realistic synthetic task/remark datasets to evaluate pagination and exports. Use query plans and measured authenticated latency; anonymous curl timings are insufficient.
3. Test desktop, 375px and 430px layouts in both themes, keyboard focus, reduced motion, modal dismissal and unsaved-draft protection. Physical iPhone Safari keyboard/landscape behavior requires a separate device check.
4. Build the exact commit on Linux through GitHub. Avoid compiling on the constrained production Droplet.
5. Restore a fresh production snapshot into a disposable database. Rehearse migrations, compare existing-record fingerprints and verify historical backfill definitions. Never alter real colleague accounts/tasks as demonstrations.
6. Prepare a verified release directory, fresh consistent database/attachment backup, previous service unit and rollback instructions. Confirm deployment timing for Release 4; the prior Release 3 switch is complete.
7. During the coordinated switch, pause app/automation only as needed, apply migrations once, switch the app, verify health and resume the jobs. Preserve the live environment and local storage.
8. Verify authenticated search/report access, task editing conflicts, notification links, previews and schedule controls. Inspect application/job errors, memory, latency and restart counts. Keep additive history/schema on rollback and preserve new writes; prefer a forward fix over restoring an old database.

## Explicit boundaries

No email sending, automatic project-access grants, employee productivity ranking, realtime/offline editing, third-party search engine or external analytics service. Off-server backup copies remain a separate operational item because they need a user-selected destination and encryption/retention decisions.

Release 3 review rules remain unchanged: eligible creator or admin approval, no self-approval, and required reasons for requested changes, withdrawal and reopening.
