# TaskTracker dark email release — prepared, sending disabled

## Design gallery

Open `email-previews/index.html` for 11 category previews, a phone/desktop toggle and plain-text versions. Examples use synthetic task data. Templates use dark navy backgrounds, lighter cards, high-contrast text, cyan action buttons and distinct review/completion/attention accents. The layouts use presentation tables and inline styles, with no fonts, images or tracking resources loaded externally.

All 11 categories were checked in the browser at 375px and 800px without horizontal overflow. The main text, footer, action button and category label color pairs measured 9.19:1–10.73:1 contrast. The rendered examples are browser previews, not proof of Gmail, Outlook or iPhone Mail rendering. Mailify may add its own unsubscribe footer; that footer is outside these templates. The provider's sample exposes only a content field, so the plain-text versions are available as artifacts but are not claimed to be sent as a multipart alternative.

Initial queued categories: assignment, mention, review requested, approved, changes requested, review updated, daily deadline digest and personal weekly report. Additional prepared designs: deadline changed, activity digest and project completed. The additional three designs do not yet have event producers.

## Prepared integration

- Migration 012 adds an email queue, separate per-member email preferences and a workspace delivery switch. All delivery starts disabled, and members start opted out. No historical notifications are copied into the queue.
- Assignment/mention/review events are captured within the existing database transaction, before in-app preferences can suppress an in-app alert. The worker sends separately; saves do not wait on network delivery.
- A deadline digest is queued once per member per India calendar date from 9 AM. It includes currently assigned overdue work and tasks due today/tomorrow, excluding done/review/archived work.
- The worker checks active accounts, current email addresses, preferences, project access, assignment membership and applicable review status before preparing an email. It omits stale events and empty digests.
- A persistent attempt state is committed before the network request. No automatic retries occur after a timeout, worker crash or ambiguous response. HTTP 200 with success=false is marked unconfirmed because the original connection test was delivered despite that response. Accepted is never labelled delivered.
- Email content is HTML-escaped and action links use the configured HTTPS app origin. No API keys, secrets or provider response bodies enter the queue, browser UI or GitHub.
- Worker memory is limited to 96 MB and it processes at most ten items per run, with a two-minute systemd timer. It uses the existing PostgreSQL service, without another queue server.

## Validation

Local lint, TypeScript, 40 unit tests and the database suite pass. Database tests cover global disabled defaults, no backlog, private preferences/queue, independent in-app suppression, deduplication, access removal, opt-out, false/timeout no-retry behavior, accepted status and daily digest generation.

The Linux browser regression adds per-member email preference persistence and confirms that saving preferences cannot enable workspace delivery. The complete Linux build and browser regression passed for commit `926159d791ad33b8b10c54e06fc347f68ff8dc67`: [CI run 34956878073](https://github.com/raavan96/tasktracker/actions/runs/34956878073).

## Rollout

No production application switch, schema migration, timer enablement or new email send was performed for this preparation. The existing connection-test configuration remains unchanged.

Before rollout, rehearse migration 012 against a backup, deploy the tested artifact with both delivery switches off, and install the timer with WorkingDirectory set to that exact release. Review the dark design through an authorized inbox test. Confirm the provider's response semantics, HTML behavior and unsubscribe handling. Enable workspace delivery and the server MAILIFY_NOTIFICATIONS_ENABLED switch only when approved; each member also needs to opt in. Do not reset unconfirmed queue items to pending without provider reconciliation.

Rollback can stop the email timer and restore the previous web release while retaining additive email tables and their attempt records. Never discard attempt records as a way to retry mail.

## Personal weekly reports

Migration 013 adds a weekly-report preference and event producer for every opted-in active member. Reports run from Monday 11 AM India time for the previous Monday-Sunday, with catch-up within that same week and one queue item per member/week. Global delivery switches remain off.

Personal statistics and pending-task links cover tasks assigned to or created by the recipient. Project summaries cover only current explicit project memberships; admin visibility, public visibility and former membership never expand the email scope. Project totals include teammates' work and are labelled separately. Active projects and projects completed during the reporting week are included. Last-week completions use completion-event timestamps with India-time boundaries; current pending/overdue/review figures are labelled now.

The worker rechecks membership and preferences when preparing the report. Removed projects are omitted; no eligible projects means cancellation. Lists are bounded to ten personal tasks and twenty projects, with remaining counts and links to the app. Tests cover privacy, admin/public exclusions, repeated scheduling, opt-out, revoked membership, empty scope and timing. The dark weekly preview shows personal statistics and project summaries.

Weekly-report follow-up passed the full Linux build, database and browser suite at commit `9aec47175f1c2bc2de473c1a0192a834335f7f0d`: [CI run 34958842311](https://github.com/raavan96/tasktracker/actions/runs/34958842311). The updated dark weekly report was checked at 375px and 800px without horizontal overflow. No production deployment or email send occurred.
