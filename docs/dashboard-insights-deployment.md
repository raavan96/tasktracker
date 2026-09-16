# Dashboard insights deployment — 16 September 2026

Production release: `fa5de9058ab9deaa399bb8524214f42aa21097f1`.

The right-edge Dashboard opens an on-demand drawer with project totals, completion progress, project health and project filters; task totals, status chart, monthly completion events, workload and a mini deadline calendar. The panel uses the existing theme tokens, native dialog and theme switch. No database migration was required.

All reads run under the signed-in user’s database permissions. Project statistics include archived projects; task status totals exclude archived tasks and archived projects. Workload lists the team for admins and only the signed-in member for other users. Completion events include reapprovals and may include estimated historical dates. Data loads on opening, refresh or calendar navigation, without polling.

## Verification

GitHub Actions run `35098443282` passed lint, unit tests, PostgreSQL staging checks, Linux production build and eight-session browser tests. Dashboard tests compare RLS-visible project IDs and task totals, verify member workload scope, unauthenticated access and date validation, and exercise filters, calendar navigation, retry and closing. The browser suite checks light/dark contrast, mobile/desktop layouts and existing workflows. Captured dashboard screens at 430px and 1440px were visually reviewed.

Live verification: HTTPS login returned 200; the authenticated dashboard loaded six projects (four active, two completed), nine active-project unarchived tasks and two deadlines for 16 September. App, automation timer and email timer were active. The switch took 7.9 seconds.

## Recovery evidence

- Release directory: `/opt/tasktracker-releases/fa5de90`
- Previous release: `/opt/tasktracker-releases/99d4393`
- Backup: `/var/backups/tasktracker/20260916T130018038951Z`
- Database backup SHA256: `232baba346c9ebb7da4a9245a015df9b9a69c9a7be1db908dffb79e64c2175f5`
- Build archive SHA256: `ee3ec213b82b44e5a9db732e3f7b31551c2aa1b8fa39b7c4d14a593cc4ba0ac7`
- Deployment evidence: `/var/backups/tasktracker/release-insights-deployment.json`
- Previous service unit: `/etc/tasktracker-release-insights-fa5de90.service.previous`

Existing records were fingerprinted during the maintenance window and preserved. Previous static assets were retained for already-open browser tabs.
