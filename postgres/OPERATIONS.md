# Production operations

Live URL: https://168.144.155.51. Data, authentication, files, and scheduled reminders now run on the DigitalOcean server. The old Supabase workspace is retained read-only; do not direct users to the old Vercel URL.

## Locations

| Component | Location |
| --- | --- |
| Running standalone app | `/opt/tasktracker-releases/2fe1ffb` |
| Production service | `tasktracker.service`, localhost:3000 |
| Private environment | `/etc/tasktracker-local.env`, root-only |
| Production database | `tasktracker_rehearsal_final_20260911` (LIVE, not disposable) |
| PostgreSQL cluster | `/var/lib/pgsql/tasktracker-staging/data`, port 55433 |
| PostgreSQL service | `tasktracker-staging-db.service` |
| Private attachments | `/var/lib/tasktracker-local/attachments` |
| Backups | `/var/backups/tasktracker`, root-only |
| Old service/config backup | `/etc/tasktracker-cutover-20260911`, root-only |

The PostgreSQL and app units are enabled for boot. The automation timer runs every 15 minutes and the backup timer every six hours. The old staging web service is stopped; port 8443 redirects to the live app. The previous Supabase app checkout remains at `/home/public_html/task-tracker` for recovery, but is not the running deployment. Pulling code there does not update the live standalone app.

The archive release `91afad7` passed Linux build, lint, unit/database tests and the existing eight-session browser workflow before deployment. The original PostgreSQL app artifact remains at `/opt/tasktracker-staging`, which also continues to supply the scheduled automation/backup scripts. UI-only rollback can restore `/etc/tasktracker-archive-91afad7.service.previous` to the app service definition and restart after daemon-reload; this retains the live PostgreSQL database and all new work. Do not use the Supabase migration rollback for a UI rollback. Old hashed static assets were retained in the new release for already-open tabs.

## Routine checks

```sh
sudo systemctl status tasktracker.service tasktracker-staging-db.service --no-pager
sudo systemctl list-timers tasktracker-backup.timer tasktracker-automation.timer tasktracker-cert-renew.timer
sudo journalctl -u tasktracker-backup.service -n 15 --no-pager
sudo journalctl -u tasktracker-automation.service -n 10 --no-pager
```

Do not paste environment files, role dumps, or database backups into chat or commit them. Backup directories contain password hashes, role credentials, and private configuration.

## Backups and restoration

Trigger a backup with `sudo systemctl start tasktracker-backup.service`. The manifest identifies the captured database, SHA-256 of `database.dump`, and paths/sizes/hashes of every referenced attachment. Application writes may briefly wait while attachment metadata is locked so files and the database use one consistent snapshot. Failed runs leave a `.partial-...` directory and do not prune successful backups. Inspect failures before removing partial directories. Twenty-eight successful backups are retained, approximately seven days at the six-hour schedule.

Automatic backups are on the same server. An initial recovery archive was copied to the user's Mac, but ongoing off-server replication is not configured; regularly copy successful backups securely to an independent device for protection against total server loss. The initial recovery archive is not a replacement for later backups.

For restoration, keep the current database and restore into a NEW database on the existing cluster. Use the PostgreSQL owner account, the existing Unix socket `/var/lib/pgsql/tasktracker-staging/socket`, port 55433, and `pg_restore --exit-on-error --single-transaction`. Root can stream the private dump to `runuser -u postgres -- pg_restore ...` without changing backup permissions. Do not overwrite the active database. Restore attachments into a NEW private directory, verify every manifest size/hash, then assign ownership to OS user `tasktracker` and modes 0700 directories/0600 files. Test the restored database and files before scheduling a configuration switch.

Recovery onto a new machine additionally requires PostgreSQL 16, the application artifact or a fresh Linux build from the locked source dependencies, required database roles/grants, systemd units, Nginx, TLS renewal, and the private environment updated for the new location. `roles.sql` is included for reconstructing missing roles; review it rather than blindly overwriting an existing cluster's roles. The tested restore was on the existing cluster, not a full-machine disaster recovery.

## Migration rollback

The old source is protected by `tasktracker_cutover_readonly_20260911` triggers on the eleven application tables, `auth.users`, and `storage.objects`. The exact SQL is in `postgres/source-freeze.sql`; reversal is in `postgres/source-unfreeze.sql`. The freeze does not delete source records.

Before new local production writes, the old service/config copies could restore the previous app and the Supabase SQL guards could be removed. Now that production is open, do not perform that simple rollback: first freeze local writes, take a fresh backup, and reconcile any new tasks, updates, accounts, and files. Otherwise users' post-migration work would be lost. Prefer repairing/restoring the local deployment while retaining PostgreSQL as the authoritative data source.

Future application deployments must preserve `/etc/tasktracker-local.env`, the database, and attachment directories. Build on Linux outside this small server, stage a separate release, validate it, and switch the service with a rollback artifact retained. Never package `.env` files into distributable artifacts.


## Archive release — 13 September 2026

Migration `006_archiving.sql` is installed in the live database. Do not apply it twice or run the empty-database initialization script against production. The migration was rehearsed in a separate copy of production and passed the synthetic PostgreSQL/browser CI workflow (run 34772412518). Current application: `/opt/tasktracker-releases/91afad7`. Tar SHA-256: `9ac600de9a8c0321f07b87ce85f7c2dcce69822317f813c46696f4de23a65e67`.

The existing `run_workspace_automation()` now calls archive automation, so the existing 15-minute timer supplies recurrence, reminders and archiving. Defaults: tasks 30 days, projects 90 days, both enabled. Admins may change/disable the rules from Archive. Explicit project completion is separate and requires all tasks done. Existing completed tasks start their retention clock at migration; restoring restarts the window. Automated archiving is non-destructive.

A fresh production backup preceded migration. Profiles, projects, tasks, remarks and attachment row counts were compared while the app was stopped and preserved. The app and automation resumed successfully. Existing environment and storage paths were unchanged. The previous service unit points to release `80c1b1a` at `/etc/tasktracker-archive-91afad7.service.previous`.

**Rollback caution:** This release includes schema and permission changes. Prefer a forward fix. If reverting the app, first pause the automation timer and disable both automatic archive settings via owner SQL; preserve all archive fields and events. The older app does not filter individually archived tasks, so rollback needs an explicit UI/access check. Do not restore an old whole-database backup over newer user work. Keep the additive schema intact.


## Creator labels — 14 September 2026

Current app release `2fe1ffb` adds project/task creator labels and an optional task-table/CSV creator column. No schema changes. GitHub run 34778669981 passed the full Linux and browser workflow, including member-visible creators and desktop/mobile column checks. Live project cards/details, task details and All Tasks were verified. A fresh backup preceded the switch; previous app `91afad7` can be restored through `/etc/tasktracker-ui-2fe1ffb.service.previous` without reverting the archive schema. Artifact SHA-256: `ef00019aa83df507c34fcc4a8a47eaba1537f8f2bf362e5afb2ac42d948aa0b9`.


## Daily interaction release — 14 September 2026

Current app: `/opt/tasktracker-releases/1e5d659` (commit `1e5d6594f38f4e5ee6588f488c77bf8c76a6f8b5`). GitHub run 34779891807 passed lint, unit/action tests, database/adapter/archive checks, Linux build and eight-user browser flows. Artifact SHA-256: `2bbcf0ba9e09fe077a18aee3ac33d2a9bc07e896ab6df9556d43e3def5af2fc0`.

Includes attention list, URL filters/sorting, remembered board/table preference, mobile filter/menu fixes, retained task drafts during Team-tab navigation, per-notification read/unread, linked workload counts and error recovery. No schema migration. Fresh backup Result=success before switch. Home/login return 200; authenticated dashboard, notifications, filtered workload navigation and mobile layouts verified. Tests used synthetic data; production walkthrough did not mutate workspace records.

Previous unit `/etc/tasktracker-ui-1e5d659.service.previous` points to intermediate release `a62717d`. The pre-Release-2 unit `/etc/tasktracker-ui-a62717d.service.previous` points to `2fe1ffb` and is the preferred rollback for the entire daily-interaction bundle. Both use the same current database and archive schema. Copy the chosen unit to `/etc/systemd/system/tasktracker.service`, daemon-reload, restart and health-check; never restore an older database over new user writes. Preserve `/etc/tasktracker-local.env` and attachments. Automation and backup timers are unchanged.


## Member search and matching themes — 14 September 2026

Live release `42815b3` (`42815b3340871e7ba83161b85665e2c006e58a33`) adds case-insensitive name/email search to New Project member selection and the existing-project Team tab. Checked members remain selected/submitted when hidden by a different query; existing members are excluded from the add selector, and a changed query clears an old pending selection. Matching/selected counts and empty states explain results.

Light and dark themes now share sidebar layout, typography, spacing, board/card/table geometry and status pills. The light palette uses white, pale blue/cyan surfaces, subtle borders and readable dark text. Theme switching was tested for identical settled geometry at 1440px and 430px.

GitHub run 34780855694 passed lint, 28 unit/action tests, database/adapter/archive checks, Linux build and eight-session browser workflows, including member search and selection retention. Live read-only checks verified both selectors, the phone Team tab and the final light dashboard. No real project or membership was created/changed for verification. No schema migration. A successful fresh backup preceded this bundle; environment/database/attachments are preserved. Artifact SHA-256 `8a0f4037466690e539155f350472f08efbfa6922c70ac520ed99f41e50b8ee05`.

Current app directory: `/opt/tasktracker-releases/42815b3`. Previous unit `/etc/tasktracker-ui-42815b3.service.previous` points to `61458b5`; the pre-bundle unit `/etc/tasktracker-ui-61458b5.service.previous` points to `1e5d659`. Restore only the selected app unit, daemon-reload, restart and health-check if needed; retain the live database and files.
