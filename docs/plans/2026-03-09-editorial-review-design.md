# Editorial Review Workflow — Design

## Goal

Add an approval gate to shared weekly editions so the editor (admin) can review, edit, and regenerate content before it goes live to users. The gate is optional — if missed, editions auto-approve before distribution.

## Status Lifecycle

`draft` → `approved` → `published`

- **draft** — freshly generated, awaiting review
- **approved** — editor reviewed and approved
- **published** — distributed to users by Saturday cron

## Schema Changes

### `weekly_editions` table
- Add `status text not null default 'draft'` with check constraint (`draft`, `approved`, `published`)
- Add `approved_at timestamptz`
- Add `approved_by uuid references profiles(id)`

### `profiles` table
- Add `is_admin boolean not null default false`

## Generation Flow

1. Friday cron generates edition → status = `draft`
2. After generation, send email to all `is_admin = true` users with link to `/admin/editions/[id]`
3. Admin can review, edit sections, regenerate individual sections
4. Admin clicks "Approve Edition" → status = `approved`, records `approved_at` and `approved_by`

## Saturday Cron Change

Before distributing to users:
1. Check edition status
2. If `draft` → auto-set to `approved` (with `approved_by = null` to indicate auto-approval)
3. After distribution → set status to `published`
4. Users always get content regardless of review status

## Admin UI Changes

### Edition List (`/admin/editions`)
- Status badge per edition (Draft = amber, Approved = green, Published = gray)
- "Needs Review" banner at top when any draft editions exist

### Edition Editor (`/admin/editions/[id]`)
- Show current status prominently
- "Approve Edition" button (green, prominent) — only shown for draft/unapproved editions
- Per-section "Regenerate" buttons (already exist)
- Edit fields (already exist)

## Admin Auth

- `is_admin` boolean flag on profiles
- All `/admin/*` routes and `/api/admin/*` API routes check `is_admin`
- Return 403 if not admin

## Auto-Approval

If the editor doesn't review by Saturday morning, the cron auto-approves the edition before distributing. This ensures:
- Users always get content on time
- The admin page shows auto-approved editions distinctly (no `approved_by`)

## Email Notification

When edition is generated:
- Query profiles where `is_admin = true`
- Send email: "This week's Poopin' Papers edition is ready for review"
- Include link to `/admin/editions/[id]`
- Use existing Resend email infrastructure
