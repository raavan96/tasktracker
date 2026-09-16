# Action menus and archive notification

Project and task dropdown actions now use matching Lucide icons for duplicate, template, edit, complete, archive/restore and delete. Shared scoped CSS aligns row heights, spacing, icon sizes and full-width targets. Destructive actions retain red text and a separator. Permissions and action handlers are unchanged.

Archive success notifications dismiss after 10 seconds. A new notification gets its own timer; manual dismissal cleans it up. In-flight Undo is protected from dismissal, and failures remain visible so the user can recover.

Release `45e824292e855536e6fb7ffe27a692a8f4126a65` passed lint, unit/database tests, build, browser workflows and theme/contrast checks: https://github.com/raavan96/tasktracker/actions/runs/35072573655

Deployed to `/opt/tasktracker-releases/45e8242`. Artifact SHA256 `4317c4b83d0bbc9f2fccaf6b868bd1db401ba2e3e6a604ceac65f3e7d0a271ce`. Backup `/var/backups/tasktracker/20260916T081722178431Z`, SHA256 `0abe0759081e1675507a987c0e34fbdb3eb78b1d29379fb480ed239cff18f14e`. No migrations; records preserved. Switch 6.4 seconds. Evidence `/var/backups/tasktracker/release-action-menus-deployment.json`.
