# Glass workspace release

Approved Apple-inspired design applied to the real workspace. The preview's synthetic charts and sample records are not production data and are not deployed.

- Shared glass shell, compact desktop icon navigation, blue primary buttons and rounded content cards in both themes.
- Existing mobile menu, task/project actions, summaries, permissions, forms and destinations retained.
- Global icon tooltips are positioned outside glass stacking contexts; keyboard focus and Escape supported. Dialog tooltips are placed in the native dialog top layer.
- Background settings: Aurora/Coast/Dusk presets, custom JPG/PNG/WebP (10 MB input limit, resized to max 1920px), dimming, opacity fallback and reset.
- Appearance is scoped to the signed-in user's ID in browser localStorage, not uploaded, shared or synchronized between devices. Private/storage-disabled browsers can apply it for the visit. Logout clears rendered appearance.
- Readable content surfaces and opaque forms/menus; blur limited to header/sidebar. Reduced transparency preference supported. No extra runtime dependency or database migration.

Validation: local ESLint and TypeScript passed. Linux CI runs all unit/database/browser workflows, appearance upload/persistence/reset, tooltip focus/hover, theme-control parity, and contrast checks in both themes. Deployment outcome to be recorded after successful checks.

## Deployment

- Release `93fa7d2118faae1d553e3211458bb13ffa2bbe14`; CI https://github.com/raavan96/tasktracker/actions/runs/35085266983 passed all stages.
- Artifact SHA256 `03bd929e71f2bd3435c3f7531e7364b0de1c3ecda7b3c0884bb0b780eec53c5b`.
- Live directory `/opt/tasktracker-releases/93fa7d2`; switch 6.3 seconds, no database migration, records preserved.
- Backup `/var/backups/tasktracker/20260916T103702892681Z`; database SHA256 `3f8d6c8d26f44724f8ac442532f35f9efecc124547ff88eb58f70017986fc86c`.
- Rollback unit `/etc/tasktracker-release-glass-93fa7d2.service.previous`; prior release `44f4702` retained.
- Server evidence `/var/backups/tasktracker/release-glass-deployment.json`.
- Public dashboard rendered existing projects and task counts after deployment.

## Deeper navy follow-up

Approved and deployed release `99d43937904150e7548c8a4e112b7cc4c56f1a05`. Dark panels/cards/fields deepened; wallpaper receives a navy veil. Light palette unchanged. Card surface color fades removed to avoid temporary low contrast during theme changes.

CI https://github.com/raavan96/tasktracker/actions/runs/35088493677 passed all stages including both-theme contrast and workflow tests. Artifact SHA256 `e7293e5c1ac15752f9071e3c83d1e337198c0c45e64061f03c3f90dbd6898906`.

Deployed `/opt/tasktracker-releases/99d4393`; switch 6.6 seconds. Backup `/var/backups/tasktracker/20260916T111139376544Z`, SHA256 `929e4d2d5ac3acba5659e115ed2a517c1b238f6a741c707e8dc6fde401ba5bc8`. No migration; records preserved. Rollback `/etc/tasktracker-release-navy-99d4393.service.previous`. Public HTTPS 200 and navy CSS verified.
