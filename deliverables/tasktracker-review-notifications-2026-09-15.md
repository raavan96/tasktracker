# Admin review and notification page update

Admins may approve submitted tasks even when they are assignees. Non-admin creators remain unable to approve a task assigned to themselves. Submission, project access, archive status, version checks, checklist and dependency validation, and approval audit records remain enforced. Migration 015 replaces only the review procedure. It was rehearsed on a restored production backup.

Notification links and read/unread buttons now share a 44px minimum height and centered alignment. A small Notification settings button at the bottom expands the in-app preferences and read-only email schedule. Settings stay mounted when collapsed, preserving edits. The toggle exposes its expanded state and respects reduced motion. Team email preferences remain locked.

Tests cover admin self-submission and approval, denial of non-admin self-approval, stale versions, wrong status and audit records. Browser coverage includes the admin flow, settings visibility, and phone/desktop action alignment with a dedicated synthetic notification fixture.

Mention picker update: Enter selects the highlighted person, Up/Down changes the selection, and Escape dismisses suggestions without closing the containing panel. Selection uses the caret position and preserves text after it. Existing mentioned members can be selected again, while the stored recipient IDs remain deduplicated. IME composition does not trigger selection. Browser regression exercises new remarks, edits with existing mentions, Escape/reopen, and insertion mid-sentence.

## Deployed and verified

Live release: `042c0fdd65a3246050e5a6a7a61cc67f4c381e8e`. Full Linux build, database and browser suite passed: https://github.com/raavan96/tasktracker/actions/runs/34967462665. The layout checks passed at 430px and 1280px; browser screenshots were also inspected from the earlier successful layout run 34966548169. Mention keyboard tests passed with actual arrow-key caret movement.

Verified artifact SHA256 `4776b6ae412964ec0b2e64678e87846f33874a343e89924f791346d802e03ac6`. Fresh backup `/var/backups/tasktracker/20260915T121745846904Z`; database SHA256 `8996da20cfd2fe4cb5f602a6fb8e56201a40f9f97ffeac95d682efa7a5a0b616`. Migration 015 preserved fingerprints of existing application records, including the user's new tasks and remarks added during preparation. Deployment took 5.6 seconds.

HTTPS login returned 200. The app, email timer and automation timer are active; app and email worker use `/opt/tasktracker-releases/042c0fd`. Deployment evidence: `/var/backups/tasktracker/release-admin-review-deployment.json`. Previous app unit: `/etc/tasktracker-release-admin-review-042c0fd.service.previous`. No production task was approved or remark edited as a test.
