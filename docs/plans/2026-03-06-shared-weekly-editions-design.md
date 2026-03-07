# Shared Weekly Editions Design

## Goal

Replace per-user AI content generation with a single shared weekly edition that all users receive by default. Users can override individual sections via chat. New signups get the current week's edition instantly with zero AI latency.

## Architecture

A new `weekly_editions` table stores one pre-generated edition per week. When a user's paper is created (signup, weekly cron, or visiting /paper), their `paper_sections` are populated from the shared edition. Chat edits mark sections as `overridden` so they aren't refreshed from the shared edition.

## Database Changes

### New table: `weekly_editions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | default gen_random_uuid() |
| `week_start` | date UNIQUE | Sunday of that week |
| `sections` | jsonb | `{ coaching: {title, body}, fun_zone: {title, body}, brain_fuel: {title, body}, this_week: {items: [...]} }` |
| `composed_html` | text | Pre-composed HTML (generic: family name = "Our Family", no issue number) |
| `issue_number` | integer | Auto-incrementing edition number |
| `created_at` | timestamptz | default now() |

No RLS — shared/public data. Written by service role (cron), read by all authenticated users.

### Modify `paper_sections`

Add column: `overridden` boolean, default `false`. Set to `true` when user edits a section via chat.

## Data Flow

### 1. Friday night cron: Generate shared edition

- New route: `GET /api/cron/generate-edition`
- Creates `weekly_editions` row for next week
- Generates AI content: coaching, fun_zone, brain_fuel, this_week (general family audience, no audience-specific tone)
- Composes HTML with "Our Family" as placeholder family name
- Stores in `weekly_editions.sections` + `composed_html`

### 2. Paper creation (signup, /paper visit, Saturday cron)

- `getOrCreateCurrentPaper()` checks for existing paper
- If creating new: look up `weekly_editions` for that `week_start`
- If shared edition exists: populate `paper_sections` from it, all `overridden = false`
- If no shared edition (edge case): fall back to per-user AI generation as today
- Compose user-specific HTML (their family name, issue number) via Sonnet

### 3. Chat edits

- When chat updates a section: set `overridden = true` on that `paper_sections` row
- Everything else unchanged

### 4. Saturday preview cron

- For each user: get or create paper from shared edition
- Non-overridden sections (`overridden = false`): refresh from latest shared edition
- Overridden sections (`overridden = true`): leave alone
- Compose user-specific HTML, send preview email

### 5. Sunday deliver cron

- No changes — already reads from `paper_sections`, composes HTML, generates PDF

## Override Rules

- Chat content edit (e.g. "make coaching about teamwork") -> `overridden = true`
- Chat structural edit (e.g. "add chore: take out trash") -> `overridden = true`
- Section enable/disable -> tracked by existing `enabled` column, no override needed
- **No cross-week persistence** — each week starts fresh from shared edition
- **Err toward fresh** — if ambiguous, default to not overriding

## Token Savings

- **Before:** N users x 4 AI content calls + N composition calls per week
- **After:** 4 AI content calls + 1 composition call (shared) + N composition calls (user-specific layout with their name/overrides)
- Content generation cost drops from O(N) to O(1)

## Signup UX Improvement

- **Before:** Sign up -> wait 10-30s for AI generation -> see paper
- **After:** Sign up -> instantly see pre-generated paper (just needs user-specific composition, ~5-10s)
