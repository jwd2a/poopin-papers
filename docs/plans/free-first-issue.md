# Free First Issue Flow

## Goal
Let new users sign up, onboard, generate and customize their first newspaper, and download the PDF — all without paying. Paywall kicks in only when they try to access a second issue or come back next week.

## Current Flow
Signup → Email confirm → /subscribe (Stripe paywall) → /onboarding → /paper

## New Flow
Signup → Email confirm → /onboarding → /paper (free first issue) → Paywall on subsequent visits

## Changes Required

### 1. Database: Add `free_issue_used` to profiles
Add migration:
```sql
alter table public.profiles
  add column free_issue_used boolean not null default false;
```

### 2. Middleware (`src/lib/supabase/middleware.ts`)
Current behavior: if `subscription_status !== 'active'`, redirect to /subscribe.

New behavior:
- If `subscription_status !== 'active'` AND `free_issue_used === false`:
  - Allow access to /onboarding and /paper (and related API routes like /api/generate-paper, /api/compose, /api/pdf/*, /api/chat, /api/sections/*, /api/papers/sections/*, /api/sync-sections)
  - After they access /paper, the paper generation flow marks `free_issue_used = true` on their profile
- If `subscription_status !== 'active'` AND `free_issue_used === true`:
  - Redirect to /subscribe (the paywall)

Also allow /onboarding for non-subscribed users (it's currently blocked).

### 3. Mark free issue as used
In the `/api/generate-paper` route (or `/api/compose` route), after successfully generating the paper for a non-subscribed user, set `free_issue_used = true` on their profile. This way the moment they get their paper generated, the free issue is "claimed."

Best place: in `/api/generate-paper/route.ts`, after successful generation, check if user has no active subscription and `free_issue_used === false`, then update it.

### 4. Signup flow redirect
In `src/app/signup/page.tsx`, change the email redirect from:
```
emailRedirectTo: .../auth/callback?next=/subscribe
```
to:
```
emailRedirectTo: .../auth/callback?next=/onboarding
```

Also in `src/app/auth/callback/route.ts`, the default `next` is already `/paper`, which is fine.

### 5. Subscribe page (`src/app/subscribe/page.tsx`)
Update messaging for users who have used their free issue:
- "Loved your first issue? Get one every week for $5/mo"
- Show a preview/reminder of what they got

### 6. Paper view — add upgrade prompt
On `/paper` page, for free users (no active subscription), add a subtle banner:
- "🎉 This is your free issue! Love it? Subscribe for $5/mo to get one every week."
- With a "Subscribe" button that goes to /subscribe

### 7. Logged-in user redirect
In middleware, when a logged-in user hits /signup or /login, currently redirects to /paper. This should still work — if they have `free_issue_used = false`, they'll land on /paper and can still use their free issue.

## Key Principles
- Free users get ONE full experience: onboarding + paper generation + chat customization + PDF download
- The paywall appears AFTER they've seen value, not before
- No credit card required for the free issue
- Admin users bypass everything (existing behavior)
