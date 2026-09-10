# Deploy the workspace upgrade

Use a maintenance window. These migrations replace existing row-level access policies and add tables/triggers; review and back up the Supabase database before applying them. Keep the current app release for recovery. Do not deploy only the app code: it requires all three migrations. Do not run migrations again after success.

1. Stop `tasktracker.service` and any other deployed instance using this Supabase project during the change. Preserve `.env.local`; never commit or print its contents.
2. In the Supabase SQL editor for project `zjjbeepetbfztbrmqpan`, run each file separately and verify success before the next:
   - `supabase/migrations/202609100001_review_status.sql` — commit the enum change first.
   - `supabase/migrations/202609100002_workspace.sql` — tables, permissions, storage, history, and project ownership.
   - `supabase/migrations/202609100003_automation.sql` — reminders, recurrence, and review notifications.
3. Upload/check out this release in `/home/public_html/task-tracker`. As the `tasktracker` service user, run `npm ci` then `npm run build -- --webpack`. Never upload Mac `node_modules` or `.next` to Linux.
4. In the existing HTTPS server block in `/etc/nginx/conf.d/tasktracker.conf`, add `client_max_body_size 12m;` to support 10 MB uploads. Run `sudo nginx -t`, then reload Nginx only if it passes.
5. Restart and verify the app:

```sh
sudo systemctl restart tasktracker
sudo systemctl status tasktracker --no-pager
curl --retry 5 --retry-connrefused --retry-delay 2 -I http://127.0.0.1:3000/login
curl -I https://168.144.155.51/login
```

6. Install the recurrence/reminder timer. The existing `.env.local` must contain the server-only `SUPABASE_SERVICE_ROLE_KEY` and Supabase URL; keep it readable only by the service user and administrators. Node 22 supports the script's environment loader.

```sh
cd /home/public_html/task-tracker
sudo cp deploy/tasktracker-automation.service /etc/systemd/system/
sudo cp deploy/tasktracker-automation.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start tasktracker-automation.service
sudo journalctl -u tasktracker-automation.service -n 20 --no-pager
sudo systemctl enable --now tasktracker-automation.timer
sudo systemctl list-timers tasktracker-automation.timer
sudo systemctl reload nginx
```

## Live smoke test

Use a clearly named QA project: member creates a project/task, assigns a project teammate, edits their own task; another member cannot edit its details; add/check an item; upload/download a small test file; verify an unfinished dependency blocks review; admin approves after requirements are complete; confirm history and notifications. Check private visibility with a nonmember, CSV export, search, and workload counts. Avoid deleting real work during testing.

If any migration fails, stop and retain the SQL error; migrations 2 and 3 are transactional. Do not rerun successful migrations or blindly restore the old app: the new approval policies can reject old workflows. Resolve the migration or restore a verified database backup and matching app together. Inspect `journalctl -u tasktracker` for app errors and the automation journal for schedule errors.
