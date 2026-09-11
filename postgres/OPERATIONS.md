# Production operations

Live URL: https://168.144.155.51. Data, authentication, files, and scheduled reminders now run on the DigitalOcean server. The old Supabase workspace is retained read-only; do not direct users to the old Vercel URL.

## Locations

| Component | Location |
| --- | --- |
| Running standalone app | `/opt/tasktracker-staging` (historical directory name) |
| Production service | `tasktracker.service`, localhost:3000 |
| Private environment | `/etc/tasktracker-local.env`, root-only |
| Production database | `tasktracker_rehearsal_final_20260911` (LIVE, not disposable) |
| PostgreSQL cluster | `/var/lib/pgsql/tasktracker-staging/data`, port 55433 |
| PostgreSQL service | `tasktracker-staging-db.service` |
| Private attachments | `/var/lib/tasktracker-local/attachments` |
| Backups | `/var/backups/tasktracker`, root-only |
| Old service/config backup | `/etc/tasktracker-cutover-20260911`, root-only |

The PostgreSQL and app units are enabled for boot. The automation timer runs every 15 minutes and the backup timer every six hours. The old staging web service is stopped; port 8443 redirects to the live app. The previous Supabase app checkout remains at `/home/public_html/task-tracker` for recovery, but is not the running deployment. Pulling code there does not update the live standalone app.

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
