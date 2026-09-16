# Light-mode visibility correction

Scope: preserve icons, navigation, layout and features; improve light-mode readability.

- Darkened secondary text, muted icons and member email labels.
- Strengthened input, select, button and card boundaries.
- Preserved white-on-teal primary actions and corrected selected board/table text.
- Kept light dropdown labels opaque throughout their short movement animation.
- Fixed a mention caret race uncovered by the regression suite: restore selection immediately after rendering instead of scheduling a later cursor move.
- Dark-theme CSS is unchanged.

Validation includes the existing functional suite, database checks, production build, automated text contrast and control parity across eleven authenticated pages at 430px and 1440px. Additional contrast scans cover open sort/grid-size menus and the project form/member picker. Screenshots reviewed for dashboard and project form. Automated checks cover the rendered test states, not every possible combination of user data or a physical iPhone Safari session.

Release and deployment evidence to be recorded after the final checks.

## Verified release

- Release: `00cb6cdbaaab35c41392afccbbec7ba7176fd5c0`.
- CI: https://github.com/raavan96/tasktracker/actions/runs/35065327905 — all checks passed; `CONTRAST_AUDIT []`.
- Artifact SHA256: `a0d9d436a09308afe6e0c965a57aca213cf6271968a96b9dfe1dab9b5aaec4ae`.
- Backup: `/var/backups/tasktracker/20260916T065311111205Z`, SHA256 `e75e028fc2603259b8b8d5d3b5984f660899ba033104c05db2c3b9043b2f5f56`.
- Deployed to `/opt/tasktracker-releases/00cb6cd`; switch 6.3 seconds. No schema migration; fingerprints preserved for existing application records.
- Public HTTPS login returned 200 and compiled CSS includes the stronger outlines and opaque menu animation.
- Server evidence: `/var/backups/tasktracker/release-light-visibility-deployment.json`.
- Previous app unit retained for rollback at `/etc/tasktracker-release-light-visibility-00cb6cd.service.previous`.
