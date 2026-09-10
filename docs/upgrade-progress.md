# Workspace upgrade

Implementation is local; production deployment and live smoke testing are pending.

## Included

- Member-created projects and tasks, assignment to project members, creator editing/deletion; project owners manage membership.
- Admin editing of names, job titles, and departments; member search and pending assignment counts.
- Outside-click/Escape dismissal with a discard prompt for edited forms.
- Dashboard summary links, relative deadlines, assignee initials, board/table switch, CSV export compatible with Excel.
- Task side panel, separate comments and history, consistent light/dark palette.
- Admin completion approval, review notifications, checklists, private file attachments (10 MB), same-project dependencies with cycle checks.
- Daily, weekly, monthly recurrence; in-app deadline reminders; admin workload report; private/workspace project visibility.

## Behavior

Existing projects remain private. Admins and project creators retain access. Workspace-visible projects are readable by all signed-in members; task writes still require project membership/ownership and task permissions. Admins approve completion; unfinished checklist items and dependencies prevent approval. Only admins can edit member details or roles.

Deadlines use Asia/Kolkata. The server timer checks every 15 minutes. Reminders appear once per task/assignee/day for tomorrow, today, and overdue work; completed/review tasks are excluded. Recurring tasks are created on their next due date, independent of completion. They copy the description, priority, current assignee, and unchecked checklist. Attachments, comments, history, and dependencies are not copied. Monthly dates keep the original day where possible (January 31 → February 28 → March 31). Set the original task to “Does not repeat” to stop its schedule.

History starts at migration time. Checklists provide the requested smaller trackable steps; independent child tasks are not implemented. Export is CSV, which opens in Excel, rather than a formatted XLSX workbook. Deleting a task removes attachment metadata; underlying private storage files require administrator cleanup and are no longer reachable through project access.

## Validation

Production build, TypeScript, ESLint, action/presentation tests, and an isolated PostgreSQL-compatible migration test. Database tests cover creator/assignee permissions, role escalation denial, review, checklist completion, dependency cycles, recurrence retry safety, reminders, private visibility, audit history, and cascading deletion. The isolated storage table tests policies, not the Supabase upload service.

Browser review against the existing database covers dashboard, board, drawer, outside-click/discard prompt, and dark table rendering. Schema-dependent UI and actual file upload/download need a live smoke test after deployment. No live task records were changed during this preview.

See [deployment steps](workspace-upgrade-deployment.md).
