# PostgreSQL staging (not a production cutover)

The `feature/postgres-staging` branch adds an opt-in local backend. `DATA_BACKEND=postgres` uses PostgreSQL, server-managed password sessions, and private files on disk. Without this setting the existing Supabase backend is retained. No live data is migrated automatically. Supabase packages remain in the repository solely for the existing backend; PostgreSQL mode does not use the hosted service.

## What is implemented

- Four pooled application connections, parameterized SQL, transaction-local user identity and row-level permissions. The web login is not a superuser/table owner.
- Admin-created users, hashed passwords, seven-day opaque sessions, HTTP-only secure cookies, login attempt limits, serialized password hashing, and session revocation on password resets/deletion.
- Existing boards, table/export, private projects, creator/assignee permissions, admin review, history, checklists, dependencies, notifications and local recurring-task automation.
- Private local attachments (10 MB limit) downloaded through a session-authenticated route. Links cannot bypass current project access.
- Isolated staging services and shared resource limits; the live application is unchanged.

The SQL adapter intentionally supports only the query syntax currently used by the application. It is not a general PostgREST server and must never be exposed as a public query endpoint. Any future query feature needs an adapter test. Approval remains admin-only, matching the existing production rules.

## Validation

`npm ci`; `npm run lint`; `node --test tests/*.test.cjs`; `node tests/postgres-staging.mjs`; `DATA_BACKEND=postgres npm run build -- --webpack`.

The GitHub workflow at `.github/workflows/postgres-staging.yml` builds on Linux with Node 22, starts a real PostgreSQL 16 service, and exercises eight browser sessions, assignment, approval and local file access before producing an artifact. These CI results are functional validation, not a repeat of the small-server capacity test. Test SQL/browser runners require a disposable database; never point them at live data.

## Server staging procedure

Use the artifact from a successful **PostgreSQL staging build** run. It contains a tarball and SHA-256 checksum; it contains no database data, environment files or passwords. Build on the CI runner, not on the 764 MiB host. This uses GitHub for build delivery only, with no runtime dependency on GitHub.

1. Upload the two artifact files to a temporary server directory. Run `sha256sum -c tasktracker-postgres-staging.sha256`. Extract into a NEW `/opt/tasktracker-staging` directory. Do not extract over `/home/public_html/task-tracker`. Keep the code owned by root, readable by the staging OS user.
2. Create an OS service account `tasktracker-staging`, with no interactive login. Create `/var/lib/tasktracker-staging/attachments` owned by that account and mode 0700.
3. Create `/var/lib/pgsql/tasktracker-staging` and its `socket` subdirectory, owned by postgres and mode 0700. Initialize its `data` subdirectory as postgres with `initdb --auth-local=peer --auth-host=scram-sha-256`. Refuse a directory that already contains data. Do not initialize or change the default cluster.
4. Append to that cluster's `postgresql.conf`:

   ```conf
   listen_addresses = '127.0.0.1'
   port = 55433
   unix_socket_directories = '/var/lib/pgsql/tasktracker-staging/socket'
   max_connections = 16
   shared_buffers = '64MB'
   work_mem = '1MB'
   maintenance_work_mem = '16MB'
   effective_cache_size = '192MB'
   max_parallel_workers_per_gather = 0
   jit = off
   ```

5. Install the staging slice and three service files from `deploy/` into `/etc/systemd/system/`; `systemctl daemon-reload`; start only `tasktracker-staging-db.service`. Do not enable startup yet. Create database `tasktracker_staging` via the private socket as postgres.
6. Run `scripts/postgres/migrate.mjs` as postgres with `DATABASE_ADMIN_URL=postgresql:///tasktracker_staging?host=/var/lib/pgsql/tasktracker-staging/socket&port=55433&user=postgres`. The initializer refuses an existing workspace. If initialization fails partway, inspect it; do not rerun over a partially initialized database. As postgres in psql, use `\password tasktracker_runtime` to set a new password without putting it in command history.
7. Create `/etc/tasktracker-staging.env` (root-owned, mode 0600) using `postgres/staging.env.example`, changing the database port to **55433**. URL-encode special characters in its password. Never place the owner connection or any Supabase key in this file. From `/opt/tasktracker-staging`, run `python3 scripts/postgres/bootstrap.py /etc/tasktracker-staging.env` as root to create the first staging admin through hidden password prompts.
8. Start `tasktracker-staging.service`. Check both service journals and `curl -I http://127.0.0.1:3104/login`. Install the separate staging Nginx config; `nginx -t` before reload. If SELinux blocks port 8443, inspect its HTTP port labels; do not disable SELinux. Allow TCP 8443 for the tester's IP in the DigitalOcean firewall when one is configured. Use **https://168.144.155.51:8443/login**. The host/forwarded-host headers must preserve the port for Server Actions.
9. Manually run `tasktracker-staging-automation.service` and inspect its journal, then install/start its timer for reminders. Use synthetic accounts and tasks first. Test eight real sessions plus uploads and report the staging slice's memory events, service restarts, response timings, and host available memory. The combined staging stack is capped at 384 MiB, in addition to the live app; a cap failure must be investigated before increasing it.

To stop staging, stop its automation timer, app service, automation service and database service. Its data and files remain. The live app and live reminder timer are separate. Staging services are deliberately not enabled for reboot until validated.

## Before production migration

Still required: inspect the actual Supabase schema/export (the standalone baseline derives from the inspected schema fixture), rehearse a full export/import with counts and attachment checksums, decide password migration/reset handling, test backup restoration, run the actual eight-user workload on the Droplet, and define a write-freeze/cutover/rollback window. The synthetic test does not verify old password compatibility. Imported users will need a deliberate credential migration; do not copy password strings or replace existing accounts blindly.

A consistent backup must include both PostgreSQL and the attachment directory; a backup stored only on the same Droplet does not cover disk/server loss. Keep a restore copy on a separate machine you control. Do not remove Supabase or change the live service until these steps are complete.
