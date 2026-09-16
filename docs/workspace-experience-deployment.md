# Workspace experience update

Deployed on 2026-09-16 to https://tasktracker.top-menus.com.

- Release: `aba7039e1da3ca7918f75b05145aadfe645fed6b`.
- GitHub Actions run: `35131012967` (all checks passed).
- Previous release: `43d968f`.
- Backup: `/var/backups/tasktracker/20260916T180727287526Z`.
- Backup SHA-256: `13d1612aa7f5f65c17bc71f85350fcf1ae5f9644d28b6d973540303973a6ea2e`.
- Migration: `postgres/016_workspace_experience.sql`.

## Changes

Dashboard date selection keeps the dashboard mounted and preserves scrolling while updating deadlines. Calendar date headings are centered. Task creators can submit and withdraw delegated work for review; existing approval restrictions remain.

New project memberships queue project assignment emails, including memberships created with a new project. Task self-assignment now queues assignment emails. The worker rechecks recipient eligibility before delivery. Existing memberships were not backfilled, and no historical notification burst was generated.

Logout redirects to the homepage. The header has an opaque surface to prevent content bleed. Back and Help buttons appear in the header. Projects have an expandable filter panel with search, creator, and completion filters. A first-use tutorial can be reopened through Help; dismissal is stored per user per browser.

## Verification

Lint, type checking, unit tests, PostgreSQL migration and permission tests, the production build, and browser workflows passed. Browser tests covered calendar scroll preservation, creator review submission, filters, tutorial navigation, Back, logout, and existing mobile/theme workflows. Desktop and mobile screenshots were inspected.

Deployment preserved fingerprints of existing application records and queued email events. The live app, email timer, and automation timer are active; public homepage and login return HTTP 200. Deployment completed in 7.5 seconds. Local signed-in browser verification after deployment was unavailable because the Mac was locked. Actual recipient inbox delivery was not exercised during these checks.
