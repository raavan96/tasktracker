# Release 3 — People and review controls

Prepared 14 September 2026 against production release `42815b3` and repository HEAD `417cb61`. Status: implementation plan; no Release 3 application or database changes have been made.

## Outcomes

1. Administrators can deactivate/reactivate members without deleting their authorship, task history or files.
2. Administrators see affected work and preview reassignment before applying it.
3. Task submission, approval and requested changes have explicit actions, reasons and an audit trail.
4. Permissions are enforced consistently in the UI, server actions and PostgreSQL, including stale sessions and direct mutation attempts.

## Approval decision

**Confirmed by the user on 14 September 2026:** an active task creator or active admin can review delegated work, but nobody approves a task assigned to themselves. A task assigned to its creator needs another eligible admin. An admin assigned a task needs its eligible creator or a different admin. Project visibility remains required.

A separate designated-reviewer role is outside this release. Reviewer eligibility is derived from task creator, current assignee, active-account state, project visibility and admin role.

Existing completed tasks stay completed. Historical approvals are not retroactively invalidated. New approval rules apply to new review decisions after rollout. Initial rollout uses an admin-controlled setting so the current policy remains active until the new flow and migration pass verification.

## 3A — Member lifecycle

### Admin experience

- Team Users adds Active/Inactive/All filters and visible account status while retaining name/email search.
- Replace routine removal with **Deactivate member** in the action menu. Permanent deletion is not part of routine offboarding.
- Confirmation shows the member, active assignments by project, pending reviews, recurring assignments, and projects they created.
- Deactivation can proceed immediately to remove access. Reassignment can be completed separately; retained assignments are clearly labelled as belonging to an inactive member, rather than silently disappearing from workload reports.
- Reassign work through a per-project preview: task, existing assignee, eligible replacement, and affected review/recurrence state. Never silently add the replacement to a private project.
- Reactivation requires confirmation explaining that retained project memberships will restore access. Reassignment is not reversed automatically, and revoked sessions do not return.
- Confirm role changes with the old/new role and access implications. Block self-deactivation and removal/demotion of the last active admin; enforce the last-admin rule under a shared transaction lock to handle concurrent administrators.

### Data and access rules

- Reuse `auth.users.disabled`, already checked during sign-in and session validation. Add safe admin lifecycle operations; do not expose password hashes or raw auth records through member listings.
- Atomically set disabled state, revoke sessions and record actor/reason/time. Recheck account activity on sensitive writes so a request authenticated before deactivation cannot write afterward.
- Preserve profiles, memberships, historical assignees, Created by values, remarks and attachment ownership. Do not rewrite Created by to simulate an ownership transfer.
- Existing project-management access remains with eligible creators/admins. Admins handle projects created by an inactive member; adding a separate transferable project-owner role is outside this release.
- Exclude inactive accounts from new assignee, teammate and reviewer selections on both the server and UI. Existing inactive assignments remain visible and labelled.
- Reminders must skip inactive recipients. Recurrence assigned to inactive accounts is held and shown as requiring attention; reassignment/resumption must avoid duplicate or catch-up task floods.

## 3B — Review workflow

### Task details

Add a dedicated **Review** block, separate from ordinary progress buttons:

- **Submit for review**: active assignee submits completed work; task must be assigned, prerequisites complete and required checklist items checked. Admin submission on behalf of another member, if retained, records both actor and assignee explicitly.
- **Approve & complete**: eligible reviewer only; requires current status Ready for review and passes the selected self-approval rule.
- **Request changes**: eligible reviewer supplies a required explanation; task returns to In progress and the assignee sees the reason.
- **Resubmit**: after addressing feedback, the assignee submits again; earlier decisions remain visible.
- Show who can review and why an action is unavailable. If no eligible reviewer exists, show an admin-resolution action rather than allowing self-approval.

### Enforcement and history

- Centralize eligibility for UI display, but independently enforce it in PostgreSQL and server actions.
- Route completion through an explicit review operation. Creation forms, generic status updates and task-edit forms must not bypass approval checks.
- Store append-only review events with decision, actor, task, reason, submission/version reference and timestamp. Do not infer review outcomes solely from status history.
- Approve/request-changes operations validate the expected task version under a row lock, so two reviewers or a concurrent edit cannot approve stale work. A rejected stale operation asks the user to refresh.
- Material changes after submission invalidate that submission and require resubmission. Reopening completed work requires an explicit action/reason; never silently retain approval after materially changing the approved assignment.
- Archived tasks/projects remain read-only. Dependency and checklist completion guards remain enforced. Direct inserts/updates, recurrence and admin paths receive explicit coverage.

### Notifications and daily view

- Notify eligible active reviewers when a task is submitted; deduplicate creator/admin overlap and preserve private-project visibility.
- Notify the active assignee on approval or requested changes, including the feedback reason.
- Extend Needs my attention with **Awaiting my review** for eligible creators/reviewers under the selected policy.
- Dashboard counts, filters, task details and notifications must agree on which tasks are awaiting review.

## Implementation map

| Area | Existing code | Planned work |
|---|---|---|
| Authentication | `src/lib/postgres/auth.ts` | Disable/reactivate transactions, session revocation and active-account rechecks. |
| User management | `src/app/auth/actions.ts`, `src/app/admin/users/` | Lifecycle actions, safe status projection, filters, confirmations and reassignment preview. |
| Task permissions | `src/lib/project-access.ts`, `src/app/dashboard/tasks/actions.ts` | Active-member validation; explicit review and reopen operations; no generic completion bypass. |
| Database | `postgres/003_workspace.sql`, `004_automation.sql`, `006_archiving.sql` | New additive migration (provisionally `007_people_review.sql`); update policies/triggers/automation without re-running old migrations. |
| Task UI | `src/app/dashboard/projects/[id]/ProjectView.tsx`, `src/components/TaskForm.tsx` | Review block, reasons, eligible actions, inactive-member labels and resubmission state. |
| Attention/notifications | dashboard and notification pages | Eligible-review lists, deduplication and active-recipient filtering. |
| Tests | `tests/*.test.cjs`, `tests/postgres-staging.mjs`, `tests/postgres-browser.mjs` | Permission matrix, transaction/race checks, retention and desktop/mobile workflows. |

## Acceptance gates

- Member-created task delegated to another member: creator can approve only if the chosen policy permits it.
- Creator equals assignee, admin equals assignee, outsider, inactive creator/reviewer and removed project member: forbidden actions are rejected by server and database, not merely hidden.
- Direct task creation/edit/status changes cannot circumvent review or active-member rules.
- Required changes reason appears in the timeline and notification; resubmission preserves the previous decision.
- Concurrent review/edit and duplicate clicks produce one valid decision and no duplicate notification.
- Deactivation denies new login and an existing session on its next request; concurrent sensitive writes are rejected. Password reset cannot inadvertently reactivate an account.
- Last-active-admin protection withstands concurrent deactivation/demotion attempts.
- Reassignment preview counts equal committed changes; stale previews require refresh. Replacements belong to the appropriate project, with no implicit private access grant.
- History, Created by labels, archived data, comments and attachment access for other eligible users remain intact.
- Inactive assignments remain visible; automated reminders/recurrence do not produce work for disabled accounts or duplicate jobs on retry.
- Both themes and 430px/desktop layouts retain parity; keyboard, focus and unsaved-change protection work. Physical iPhone Safari verification remains a separate device check.

## Deployment sequence

1. Approval policy is confirmed above. Implement it consistently across UI, server actions and database guards.
2. Implement 3A and 3B as separately reviewable commits, with their database operations and tests. Build the combined candidate on Linux outside the constrained Droplet.
3. Restore a fresh production snapshot into a disposable database. Apply only the new migration and verify record counts, historical attribution, enabled accounts, archive rules and automation. Test with synthetic accounts there; do not disable or approve real production work as a demonstration.
4. Take a fresh production database/attachment backup. Stage the verified app in a separate release directory. Preserve `/etc/tasktracker-local.env`, attachments and live database paths.
5. Arrange a brief maintenance window for the coordinated app/schema switch. The prior migration-window approval applied to that earlier cutover; confirm availability for this new rollout once the release is concrete and verified.
6. Pause app/automation, apply the additive migration transactionally, switch the service, verify health, then resume automation. Initially keep the legacy review policy selected; activate the agreed policy only after compatible app/schema checks pass.
7. Check login, private visibility, team status, review controls, archive reads and job health. Compare production counts and inspect errors without changing real work for tests.
8. Retain the previous app and service unit. Prefer disabling the new review setting and a forward fix if needed. Before app rollback, verify the previous app still respects disabled accounts and the new database guards. Preserve disabled states, review events and all new work; never restore an old whole-database backup over live updates.

## Completion deliverables

Reviewed migration, tested application build, permission matrix results, synthetic admin/member workflow evidence, updated operations/rollback instructions and concise user release notes. No additional external service or server upgrade is required by this design; validate the final implementation within the current memory limits.
