# Staging deployment — 11 September 2026

The separate PostgreSQL staging app is running at https://168.144.155.51:8443/login.
Production remains on HTTPS port 443, localhost port 3000, using Supabase. No production users, data, or files were migrated.

Staging uses the verified Linux artifact for commit 13aa31b, plus the checked-in PostgreSQL service fix for CentOS SELinux domain transitions (omit NoNewPrivileges only on the database service). The installation's source bundle remains at /opt/tasktracker-staging. Data is at /var/lib/pgsql/tasktracker-staging/data, PostgreSQL listens on localhost:55433, and Next.js listens on localhost:3104. Files are at /var/lib/tasktracker-staging/attachments.

The database and app services are active but not enabled for automatic startup. The staging automation timer is started for this boot, with a 15-minute interval. The combined staging slice has a host-specific override at /etc/systemd/system/tasktracker-staging.slice.d/memory.conf: MemoryHigh=224M, MemoryMax=256M, with no swap. This is tighter than the generic template to preserve live-app headroom.

Checks passed: public HTTPS, browser admin sign-in, project/task creation, checklist completion, local file upload, review submission and approval, and automation. One sample project named Staging verification remains for review. Final snapshot: about 262 MiB host memory available; no staging memory limit/OOM events; no service restarts after the PostgreSQL startup fix. Live HTTPS continued to return 200.

Eight-session browser tests passed on GitHub with PostgreSQL 16. An eight-session authenticated HTTPS workload subsequently passed on the actual Droplet: 597 requests, eight concurrent 1 MiB uploads, 184 remarks, and review/approval; staging peak 175.3 MiB, minimum host available memory 186.9 MiB, and no HTTP failures/OOM/restarts. These were HTTP sessions, not rendered browsers. Eight simultaneous logins took up to 6.5 seconds, and status saves had 1.8-second p95 latency. All temporary users/projects/files were cleaned up. See scripts/staging-load/README.md for workload limits. Production migration, credential migration, backup/restore rehearsal, and cutover remain separate work.

Staging credentials are in root-only /etc/tasktracker-staging-admin.txt; database runtime configuration is root-only /etc/tasktracker-staging.env. Do not print them into logs or commit them. A private local copy of the initial admin login was provided to the user outside the Git repository.
