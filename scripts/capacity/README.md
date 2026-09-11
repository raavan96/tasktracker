# Constrained Droplet capacity test

This is a preliminary PostgreSQL capacity test, not a completed Supabase migration or eight authenticated browser sessions. It measures task-like SQL with eight persistent connections while the existing Next.js service remains resident and continues using Supabase. Synthetic data: eight members, 24 projects, 10,000 tasks, 50,000 remarks, and 50,000 history records. Each transaction reads summaries, a project list, remarks and history; 20% also write a task update, history and remark. Production authentication, permission checks, attachments, and Next.js-to-Postgres round trips are not measured.

The first phase offers eight transactions/second for three minutes; the second applies a one-minute burst from eight clients. Neither rate is an estimate of eight people's behavior: they are explicit test loads. Durability stays enabled. SQL is limited to a disposable local cluster with no TCP listener and a private socket. The test refuses an existing data directory. It stops its own cluster on completion and leaves logs/data for inspection. Do not delete or alter the default PostgreSQL cluster.

## Prerequisites and installation

First inspect the server's existing PostgreSQL packages and available streams. On CentOS Stream 9, confirm the PostgreSQL 16 stream before using the distro `postgresql:16/server` module and `postgresql-contrib` package. The runner expects `initdb`, `pg_ctl`, `createdb`, `psql`, and `pgbench` on PATH. `vmstat` and `curl` are also required. Do not initialize, start, or enable the default database service for this test.

Transfer only this directory to the server; no app restart, live branch checkout, database credentials, or `.env` change is needed. As root, create a unique directory beneath `/var/lib/pgsql`, copy seed.sql/workload.sql/run.sh there, and give it to the postgres OS user.

Run the script in a transient systemd unit with User/Group=postgres, WorkingDirectory set to that test directory, MemoryHigh=192M, MemoryMax=256M, MemorySwapMax=0, CPUQuota=50%, TasksMax=64, RuntimeMaxSec=420, and KillMode=control-group. Use a unique unit name; do not reuse the live `tasktracker` unit. For example, after preparing `/var/lib/pgsql/tasktracker-capacity-YYYYMMDD-HHMMSS`:

```sh
sudo systemd-run --unit=tasktracker-capacity-YYYYMMDD-HHMMSS \
  --property=User=postgres --property=Group=postgres \
  --property=WorkingDirectory=/var/lib/pgsql/tasktracker-capacity-YYYYMMDD-HHMMSS \
  --property=MemoryHigh=192M --property=MemoryMax=256M --property=MemorySwapMax=0 \
  --property=CPUQuota=50% --property=TasksMax=64 --property=RuntimeMaxSec=420 \
  --property=KillMode=control-group \
  /usr/bin/bash /var/lib/pgsql/tasktracker-capacity-YYYYMMDD-HHMMSS/run.sh
```

Collect the unit's journal, Result/ExecMainStatus/MemoryPeak, steady.log, burst.log, vmstat.log and app-availability.log. If systemd rejects a property, stop and inspect its version; do not silently remove memory limits. The cap covers Postgres, pgbench and helper processes together and reserves CPU capacity for the live app. A cap-related failure indicates the test budget was insufficient; it does not by itself prove that PostgreSQL cannot run on the host.

## Interpretation

Initial targets: no SQL failures, no OOM/timeouts, local login remains HTTP 200, steady load meets its offered rate without growing scheduling lag, and host memory retains reasonable headroom (initial target 100 MiB available). Inspect latency distributions/aggregate logs, not only a single average. Review any swapping or app slowdowns before increasing limits. These are engineering test targets, not a production capacity guarantee.

Even a pass requires a later staging test of the replacement backend with eight authenticated sessions and representative permissions, uploads and background jobs. Do not switch live traffic based solely on this result. Avoid Next.js builds during this test; production builds require a separate memory assessment. No swap is added by this test, so we measure the current host rather than hiding pressure with new swap.
