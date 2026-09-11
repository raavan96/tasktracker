#!/usr/bin/env bash
set -euo pipefail
# Run ONLY inside the bounded transient systemd unit documented in README.md.
cd -- "$(dirname -- "$0")"
if [[ $(id -un) != postgres ]]; then echo 'Run as postgres inside the documented systemd unit.'; exit 1; fi
for tool in initdb pg_ctl psql createdb pgbench vmstat curl; do command -v "$tool" >/dev/null || { echo "Missing tool: $tool"; exit 1; }; done
if [[ -e data || -e socket ]]; then echo 'Use a fresh test directory. Existing test data will not be overwritten.'; exit 1; fi
mkdir -m 700 socket
export PGHOST="$PWD/socket" PGPORT=55432 PGDATABASE=tasktracker_capacity
started=0
monitor_pid=''
probe_pid=''
cleanup() {
  [[ -z "$monitor_pid" ]] || kill "$monitor_pid" 2>/dev/null || true
  [[ -z "$probe_pid" ]] || kill "$probe_pid" 2>/dev/null || true
  if [[ "$started" = 1 ]]; then pg_ctl -D data -m fast -w stop || true; fi
}
trap cleanup EXIT
initdb -D data --auth-local=peer --auth-host=scram-sha-256 > initdb.log
cat >> data/postgresql.conf <<CONFIG
listen_addresses = ''
port = 55432
unix_socket_directories = '$PGHOST'
max_connections = 16
shared_buffers = '64MB'
work_mem = '1MB'
maintenance_work_mem = '16MB'
effective_cache_size = '192MB'
max_parallel_workers_per_gather = 0
jit = off
CONFIG
pg_ctl -D data -l postgres.log -w start
started=1
createdb "$PGDATABASE"
psql -X -v ON_ERROR_STOP=1 -f seed.sql > seed.log
psql -X -c 'SELECT pg_size_pretty(pg_database_size(current_database())) AS synthetic_database_size;'
vmstat -w 2 > vmstat.log & monitor_pid=$!
# This probes availability only; /login is NOT an authenticated application workload.
(while true; do printf '%s ' "$(date -u +%FT%TZ)"; curl -sS --max-time 5 -o /dev/null -w 'http=%{http_code} ttfb=%{time_starttransfer} total=%{time_total}\n' http://127.0.0.1:3000/login || true; sleep 5; done) > app-availability.log 2>&1 & probe_pid=$!
printf '\nEight persistent clients, eight transactions/sec total, three minutes:\n'
pgbench -n -c 8 -j 1 -T 180 -R 8 -P 15 -r -l --aggregate-interval=15 -f workload.sql "$PGDATABASE" 2>&1 | tee steady.log
printf '\nEight persistent clients, unthrottled one-minute burst:\n'
pgbench -n -c 8 -j 1 -T 60 -P 15 -r -l --aggregate-interval=15 -f workload.sql "$PGDATABASE" 2>&1 | tee burst.log
printf '\nFinal host memory:\n'
free -h
printf '\nLocal app availability samples:\n'
tail -12 app-availability.log
printf '\nTest finished. The disposable database will now stop. Supabase and app configuration were not changed.\n'
