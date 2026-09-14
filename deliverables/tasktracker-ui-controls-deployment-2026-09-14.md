# Navigation and view controls — deployed 14 September 2026

Live application commit: `8478fecbdf233bb9316190506c3c2e73bb2984f2`.
[Exact release CI](https://github.com/raavan96/tasktracker/actions/runs/34836345141) passed lint, unit/database tests, production build and the eight-session browser workflow.

Changes: requested navigation order with icon-only Search; right-aligned sorting/grid-size icon menus; grid/list and active/archived segmented controls; 240ms card translation/fade with no scaling or extra animation dependency. Reduced-motion disables the transitions. Project collection preferences are stored separately from task board preferences.

Validation included remembered menu choices, keyboard dismissal/focus, navigation order, multiple project cards, reduced-motion behavior, 375/430/1280px layouts and visual screenshot inspection. Live checks confirmed signed-in project pages, icon dropdowns, grid/list toggles and active/archived task filtering. No production test records were created.

- Artifact SHA-256: `5df374844e6d840bf0af800755deae31eba5393dc07e8a15d1658d672bcf0384`.
- Release directory: `/opt/tasktracker-releases/8478fec`.
- Fresh consistent backup: `/var/backups/tasktracker/20260914T120158543491Z`.
- Backup database SHA-256: `8367fb0cb6630c2cdea7bceb4f18d302e3e8666ff5442ff5fe0dfa1f32d96ba6`.
- No database migration. Existing record fingerprints preserved, including 12 accounts, four projects, seven tasks and 21 history records.
- Switch and checks: 5.8 seconds. HTTPS login 200; app active, zero automatic restarts; reminder, backup and certificate timers active.
- Server deployment record: `/var/backups/tasktracker/ui-controls-deployment.json`.
- Rollback unit: `/etc/tasktracker-ui-controls-8478fec.service.previous`, pointing to `/opt/tasktracker-releases/d77ad78`. Restore that app unit if needed; do not overwrite newer user data with a database restore.
