# Light theme parity verification

Prepared release `faffa088e16ab905f16d3e707923f5dec367198e` passed [Linux build and browser run 34971126212](https://github.com/raavan96/tasktracker/actions/runs/34971126212). Not deployed; production remains on `042c0fd`.

Source audit: the only conditional theme rendering is the sun/moon toggle. Theme changes do not select different task, project, permission, or action implementations. The app change is limited to light-scoped CSS.

Browser comparison at 430px and 1440px covers Projects, My Tasks, All Tasks, Calendar, Reports, Templates, Archive, Workload, Team Users, Notifications and an open project task discussion drawer. Controls match in label, destination, type, visible state, enabled state, pointer-event availability and field value. Layout and typography checks passed; rounded corners are intentionally allowed to differ per the approved design. Streaming rendering is allowed to settle before comparison. This is not exhaustive coverage of every possible account/data combination.

The complete existing workflow suite also passed: private access, assignment, local file upload/download, task review including admin self-approval, remarks and mentions, saved preferences, exports and multi-user operations. No theme-specific missing control or functionality gap was found in these checks.

## Production deployment

User approved deployment after confirming existing icons and structure must remain unchanged. Deployed the exact tested artifact `faffa088e16ab905f16d3e707923f5dec367198e` on 15 September 2026. Only the app stylesheet changed relative to live `042c0fd`; other differences were tests/documentation. Preview-only markup and icons were not included.

Artifact SHA256: `c3d0db99e2c6c4ba14a81cdfb1682427fe7626c9d408d11a9436480f86b93b42`. Fresh backup `/var/backups/tasktracker/20260915T131230635232Z`, database SHA256 `eaed3d9a5898fee1483f4e4d1b40d49b46cd565662ea0fb497117fdeadd74eeb`. No schema migration. Existing application record fingerprints preserved. Switch completed in 5.7 seconds.

Public HTTPS login returned 200 and the served stylesheet contains the new teal/mist palette. App, email timer and automation timer are active. Evidence: `/var/backups/tasktracker/release-light-theme-deployment.json`. Previous unit: `/etc/tasktracker-release-light-theme-faffa08.service.previous`. Current release directory: `/opt/tasktracker-releases/faffa08`.
