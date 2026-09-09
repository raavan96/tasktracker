# TaskTracker: workflow and UI improvements

This branch keeps the existing Next.js, Supabase, and Vercel stack.

## Changes

- Light/dark toggle with a remembered cookie preference, Geist typography, readable input values and placeholders, and visible keyboard focus.
- Shared workspace navigation on admin and dashboard pages, including mobile navigation and current-page highlighting.
- An Edit task form for title, description, assignee, priority, deadline, and status. Admins and task creators can edit; assignees can change status.
- Native task dialogs with focus containment, Escape dismissal, and mobile scrolling; keyboard-accessible task cards.
- Explicit teammate-to-project-to-assignment guidance, a controlled teammate selector, and actionable membership errors.
- Save errors remain visible and preserve entered text. Selected task details derive from refreshed server data, keeping comments and statuses up to date.
- Deadline display on task cards and details; dates and times on remarks.
- Password setup page and invitation/recovery callback handling for PKCE codes, supported token hashes, and default invitation fragments. Signed-in users can access password setup.
- Server checks for task/project access, assignee membership, valid task fields, and writes that affect no rows.

## Theme and deletion follow-up

- Use the sun/moon button in the workspace header or login screen. The preference is stored in a one-year same-site cookie and applied during server rendering to avoid a light flash on reload.
- Open a task and choose **Delete task**. Admins and the task creator have this option.
- Open a project and choose **Delete project**. Only admins have this option, and the exact project name must be entered before confirming.
- Archived records can also be deleted. Task/project deletions check access on the server, return write errors, and refresh affected lists.
- Deletion uses one parent-row DELETE, with dependent cleanup governed by existing Supabase foreign keys/triggers. Verify the project-to-tasks/notes/members and task-to-comments relationships use ON DELETE CASCADE in staging before release. No database cascade or RLS settings were changed here. Restrictive foreign keys cause the deletion to fail rather than partially deleting data.

## Validation

- `npm run build -- --webpack` and `npm run lint`. The normal Turbopack build hit a local sandbox port-binding restriction; the Webpack production build passed.
- `node --test tests/task-actions.test.cjs`: 17 tests against real action modules with mocked Supabase responses. No database writes.
- Browser checks: actual account sign-in, Team Management, project board, prefilled edit form, teammate selector, and 390px mobile navigation/form bounds.
- Follow-up browser checks: light/dark switching, dark preference after reload, both confirmation dialogs, exact-name project confirmation, cancellation, and 390px mobile layout.
- No live invitations, task edits, comments, role changes, removals, or password changes were submitted. Real Supabase write policies and account creation still need a staging check.

## Before merging to production

1. New onboarding uses the server-only Supabase Admin createUser API with email_confirm enabled. No SMTP or email redirect configuration is needed for account creation. Existing callback routes remain compatible with older links.
2. Confirm the server-only `SUPABASE_SERVICE_ROLE_KEY` is configured in Vercel. Never prefix it with `NEXT_PUBLIC_` or commit `.env.local`.
3. In a staging Supabase project, create a test teammate with an admin-assigned password, sign in with that email and password, add them to a project, assign a task, edit it, and post an update. Confirm both admin and member views refresh and denied writes show an error.
4. Verify existing Supabase RLS policies match the intended admin/member permissions. This branch does not modify the database schema, triggers, or policies; removal still uses the existing `remove_member_and_reassign_tasks` function.
5. Review and merge this branch when ready. Pushing this branch does not merge it into `main`; Vercel may build a preview automatically.

Supabase references: [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Accounts without invitation emails

- Team Users → Create New Member accepts a name, company email, role, password, and confirmation. Admin authorization is checked on the server before using the service role client. Passwords are sent only to Supabase Auth, never saved in profiles or returned in success messages.
- Creates a confirmed Auth account and upserts its workspace profile. Duplicate email errors never reset existing passwords. If profile setup fails after Auth creation, the UI explicitly reports the partial result; repair that account’s profile before retrying onboarding.
- Admins can reset another workspace member’s password in Team Users. Members can use the key icon in the workspace header to change their own password. Login recovery guidance directs users to an admin rather than sending email.
- Share credentials privately. Passwords require at least eight characters and matching confirmation; additional Supabase password policy errors are displayed.
- `node --test tests/*.test.cjs` covers admin-only access, input validation, confirmed account creation, profile setup, duplicate/partial failures, and password resets using mocked Supabase calls. No real accounts or passwords were changed during verification.
- Before release, verify staging account creation, sign-in, role, assignment, admin reset, and member password change. Supabase’s optional password-change security notifications are a separate project setting; this code does not invoke invitation or recovery emails.

API reference: [Supabase admin account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

Latest verification: 24 automated tests, ESLint, TypeScript, and Webpack production build passed. The local Team Users page shows the new form and Change password link. Account writes and password changes were not submitted against production.
