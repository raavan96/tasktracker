# False unsaved-change warning

The task drawer previously compared every form field against an opening snapshot or HTML default. Asynchronously loaded schedule controls could differ from their HTML defaults before any user edit, causing a false discard prompt.

The modal now checks only user-edited fields, capturing their original values on focus or pointer interaction. Untouched fields loaded later do not mark the panel dirty. Reverting a value removes its dirty condition. Actual unsaved edits still require confirmation, and cancellation preserves them.

CI https://github.com/raavan96/tasktracker/actions/runs/35067578209 passed for release `de8b2aa6022cf86fd2ae73c4ffbbd8f8b56309df`: lint, unit/database checks, production build, full browser suite, theme parity and contrast. New regression checks cover outside-click dismissal with a loaded recurring schedule, real edit warning/cancellation, and quiet Escape dismissal after reverting the edit.

Deployment: `/opt/tasktracker-releases/de8b2aa`; artifact SHA256 `90a8657c7fad6c0df52e43a1d32556be564d1be2250c4ffd9c76b5fe0f59bb76`. Backup `/var/backups/tasktracker/20260916T072020482047Z`, SHA256 `c03d719a7a0d13aaba8073c01bda52b9975b64970942b785b5b7174809692ce3`. No schema migration; records preserved. Switch 6.4 seconds. Server evidence `/var/backups/tasktracker/release-dialog-dismissal-deployment.json`.
