# Workspace-managed email subscriptions

Requested behavior: subscribe the whole team and remove member email preference controls.

Migration 014 subscribes existing profiles to assignments, mentions, review updates, deadline summaries and weekly reports. A profile-insert trigger automatically subscribes future members. The worker still excludes inactive accounts and inaccessible projects/tasks. Weekly reports remain scoped to the recipient's current project memberships and personal work.

Members and admins using the app cannot insert, update or delete email preferences. The save action was removed and the form replaced by a read-only schedule notice. In-app notification preferences remain separate. The server delivery switch and service-role operational controls remain available for maintenance.

The Mailify-added unsubscribe footer is outside the application's controls. Removing in-app preferences does not remove or override provider suppression.

Local lint and database tests passed, including backfill, new-member enrollment, and direct authenticated write rejection. The migration was also rehearsed against a restored production backup. Production rollout evidence follows after verification.

## Production verification

Deployed `8c72c2cab42e29f6e06410570ce7606aad8fdf53` after [CI run 34964855714](https://github.com/raavan96/tasktracker/actions/runs/34964855714) passed all Linux build, unit, database and browser checks. Verified archive SHA256: `3b98a9b3a4b41ddcfc26c287f1e1d6b8422b84bed28756db0ce2b88cb5541178`.

Backup `/var/backups/tasktracker/20260915T114831504620Z`, database SHA256 `4987bcd5599f7297a442ab342ee366351136a33c066c7802ebd222dbd996d702`. Migration 014 preserved all pre-existing application record fingerprints; subscriptions were intentionally updated. Deployment completed in 6.3 seconds. Evidence `/var/backups/tasktracker/release-managed-email-deployment.json`.

All 12 active accounts are fully subscribed. Authenticated INSERT/UPDATE privileges are absent. The app, email timer and automation timer are active; HTTPS login returns 200. The email worker completed successfully. Initial queue snapshot: 10 unconfirmed attempts, 5 pending for a later batch. Unconfirmed is not proof of delivery or failure and is never automatically retried. No claim of inbox delivery is made.

Rollback: stop the email timer before changing application versions. The previous app release is `0fcb521`; retain email queue attempt records. Migration 014 intentionally removes authenticated write access, so the former preference form would be unusable after an app-only rollback. Keep the current read-only UI or explicitly reconcile the subscription policy before restoring a preference form.
