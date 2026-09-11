# Eight-session staging HTTP workload

This is an explicitly invoked, destructive-to-its-own-test-data harness for **only** the isolated staging app on port 8443 / PostgreSQL on port 55433. It is not a default CI job. The live app receives read-only `/login` availability probes.

`seed.mjs` runs as the PostgreSQL OS user on the Droplet and creates a private manifest beneath `/var/lib/pgsql/tasktracker-staging/load-...`: eight random-password accounts, two private projects and 33 synthetic tasks. It extracts only action IDs/names from the deployed build manifest, never its encryption key. Copy the run manifest to a mode-0600 local temporary file without printing it.

Run `node scripts/staging-load/run.mjs /path/to/private-run.json /path/to/results`. The generator runs locally, not on the Droplet. It uses the deployed Server Action IDs and this repository's matching Next.js React argument encoder, eight independent cookies, and external HTTPS. It records login, page, save, remark and file latency and samples host memory plus the live app's local availability every two seconds. It aborts client requests below 96 MiB available memory, on a staging OOM kill, or two successive live-probe failures. Monitor failure before load also aborts. Requests time out after 20 seconds.

After concurrent logins and permission checks, each actor uploads/downloads one 1 MiB file. For three minutes, each actor performs a project-page read, status save and remark approximately every eight seconds. There are four tasks per actor; the status saves include repeated values, so not every save creates a status-history entry. The final step submits a member-created task for review and approves it as admin.

This tests application/server correctness and load, **not browser rendering**, mobile interactions, very large histories, 10 MiB concurrent uploads, or long-duration stability. Results include client-network latency for staging and localhost latency for live-app probes. The CI browser workflow separately covers UI behavior.

After all workers have finished, run `verify-cleanup.mjs RUN_DIRECTORY EXPECTED_COMMENT_COUNT` as the PostgreSQL OS user. It verifies persisted counts/review status before deleting only that manifest's two projects and eight accounts. It writes a file-cleanup manifest; as root, remove only those validated UUID directories under `/var/lib/tasktracker-staging/attachments`. Keep the actual staging admin/sample project. Delete the now-invalid private local run manifest after verification. Never apply cleanup to an unreviewed manifest or the production database.
