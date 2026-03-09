# Editorial Review Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an approval gate to shared weekly editions so admins can review/edit/regenerate before content goes live, with auto-approval if missed.

**Architecture:** Add `status` lifecycle (`draft` → `approved` → `published`) to `weekly_editions` table and `is_admin` flag to `profiles`. Admin routes check the flag. Friday cron emails admins when editions are ready. Saturday cron auto-approves drafts before distributing.

**Tech Stack:** Supabase migrations, Next.js API routes, Resend email, React UI

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/005_editorial_review.sql`

**Step 1: Write migration**

```sql
-- Editorial review: status lifecycle for weekly editions + admin role

-- Add status lifecycle to weekly_editions
alter table public.weekly_editions
  add column status text not null default 'draft'
    check (status in ('draft', 'approved', 'published')),
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id);

-- Mark any existing editions as published (they've already been distributed)
update public.weekly_editions set status = 'published' where status = 'draft';

-- Add admin flag to profiles
alter table public.profiles
  add column is_admin boolean not null default false;
```

**Step 2: Apply migration**

Run: `npx supabase db reset`
Expected: All migrations apply cleanly

**Step 3: Commit**

```bash
git add supabase/migrations/005_editorial_review.sql
git commit -m "feat: add editorial review schema (status lifecycle + admin flag)"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types/database.ts`

**Step 1: Update WeeklyEdition type**

Add `status`, `approved_at`, `approved_by` fields to `WeeklyEdition`:

```typescript
export type EditionStatus = 'draft' | 'approved' | 'published'

export type WeeklyEdition = {
  id: string
  week_start: string
  sections: {
    coaching?: { title: string; body: string }
    fun_zone?: { title: string; body: string }
    brain_fuel?: { title: string; body: string; riddle_answer?: string }
    this_week?: { items: Array<{ text: string; icon?: string }> }
  }
  composed_html: string | null
  issue_number: number
  status: EditionStatus
  approved_at: string | null
  approved_by: string | null
  created_at: string
}
```

**Step 2: Add `is_admin` to Profile type**

```typescript
export type Profile = {
  id: string
  email: string
  family_name: string | null
  timezone: string
  audience: Audience[]
  intranet_url: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}
```

**Step 3: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "feat: add EditionStatus and is_admin types"
```

---

### Task 3: Admin Auth Guard

**Files:**
- Create: `src/lib/admin.ts`
- Modify: `src/app/api/admin/editions/route.ts`
- Modify: `src/app/api/admin/editions/[id]/route.ts`
- Modify: `src/app/api/admin/editions/generate/route.ts`
- Modify: `src/app/admin/editions/page.tsx`
- Modify: `src/app/admin/editions/[id]/page.tsx`

**Step 1: Create admin auth helper**

Create `src/lib/admin.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Check if the current user is an admin. Returns the user if admin, or a 403 response.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, supabase }
}

/**
 * Server component version: check if current user is admin.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin === true
}
```

**Step 2: Guard API routes**

In each admin API route (`src/app/api/admin/editions/route.ts`, `src/app/api/admin/editions/[id]/route.ts`, `src/app/api/admin/editions/generate/route.ts`), replace the auth check pattern:

```typescript
// BEFORE:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// AFTER:
import { requireAdmin } from '@/lib/admin'

const auth = await requireAdmin()
if ('error' in auth) return auth.error
const { user, supabase } = auth
```

**Step 3: Guard admin pages**

In `src/app/admin/editions/page.tsx` and `src/app/admin/editions/[id]/page.tsx`, add at the top of the component:

```typescript
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'

// Inside component, before any other logic:
if (!(await isAdmin())) redirect('/login')
```

**Step 4: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 5: Commit**

```bash
git add src/lib/admin.ts src/app/api/admin/ src/app/admin/
git commit -m "feat: add admin auth guard to all admin routes"
```

---

### Task 4: Approve Edition API Endpoint

**Files:**
- Modify: `src/app/api/admin/editions/[id]/route.ts`

**Step 1: Add PATCH handler for approval**

Add a new `PATCH` export to `src/app/api/admin/editions/[id]/route.ts`:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { user } = auth

  const { id } = await params
  const { status } = await request.json() as { status: string }

  if (status !== 'approved') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await db
    .from('weekly_editions')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/app/api/admin/editions/[id]/route.ts
git commit -m "feat: add approve edition PATCH endpoint"
```

---

### Task 5: Admin Review Email

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/app/api/cron/generate-edition/route.ts`

**Step 1: Add review notification email function**

Add to `src/lib/email.ts`:

```typescript
export async function sendEditionReviewEmail(
  to: string,
  editionId: string,
  weekStart: string,
  issueNumber: number
) {
  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/editions/${editionId}`

  await getResendClient().emails.send({
    from: "Poopin' Papers <papers@poopinpapers.com>",
    to,
    subject: `Edition #${issueNumber} is ready for review`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="font-size: 24px; color: #292524;">New Edition Ready</h1>
        <p style="color: #44403c; font-size: 16px;">
          Edition #${issueNumber} (week of ${weekStart}) has been generated and is waiting for your review.
        </p>
        <p style="color: #44403c; font-size: 14px;">
          Review the content, edit or regenerate any sections, then approve it. If you don't review it by Saturday morning, it will be auto-approved.
        </p>
        <a href="${reviewUrl}" style="display: inline-block; background: #292524; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; margin-top: 16px;">
          Review Edition &rarr;
        </a>
      </div>
    `,
  })
}
```

**Step 2: Send review emails after generation**

In `src/app/api/cron/generate-edition/route.ts`, after the successful insert, add:

```typescript
import { sendEditionReviewEmail } from '@/lib/email'

// After successful insert, before the return:

// Notify admin users
const { data: admins } = await supabase
  .from('profiles')
  .select('email')
  .eq('is_admin', true)

const editionId = /* get from insert result — need to update insert to return id */

for (const admin of admins ?? []) {
  try {
    await sendEditionReviewEmail(admin.email, editionId, weekStart, issueNumber)
  } catch (err) {
    console.error(`[generate-edition] Failed to notify ${admin.email}:`, err)
  }
}
```

Note: The existing insert doesn't `.select()` the result. Update the insert to:

```typescript
const { data: inserted, error: insertError } = await supabase
  .from('weekly_editions')
  .insert({
    week_start: weekStart,
    sections,
    composed_html,
    issue_number: issueNumber,
  })
  .select('id')
  .single()

if (insertError) { /* existing error handling */ }

// Then use inserted.id for the email
```

**Step 3: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 4: Commit**

```bash
git add src/lib/email.ts src/app/api/cron/generate-edition/route.ts
git commit -m "feat: send review notification email to admins after edition generation"
```

---

### Task 6: Saturday Cron — Auto-Approve and Publish

**Files:**
- Modify: `src/app/api/cron/saturday-preview/route.ts`

**Step 1: Auto-approve draft editions before distributing**

At the top of the `GET` handler, after auth check and creating the supabase client, add:

```typescript
// Auto-approve any draft editions for the current week
const weekStart = getCurrentWeekStart()

const { data: draftEdition } = await supabase
  .from('weekly_editions')
  .select('id, status')
  .eq('week_start', weekStart)
  .eq('status', 'draft')
  .single()

if (draftEdition) {
  console.log(`[saturday-preview] Auto-approving draft edition ${draftEdition.id}`)
  await supabase
    .from('weekly_editions')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      // approved_by left null to indicate auto-approval
    })
    .eq('id', draftEdition.id)
}
```

**Step 2: Set edition to published after all users processed**

At the end of the handler, before returning:

```typescript
// Mark edition as published after distribution
if (processed > 0) {
  await supabase
    .from('weekly_editions')
    .update({ status: 'published' })
    .eq('week_start', weekStart)
    .in('status', ['draft', 'approved'])
}
```

**Step 3: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 4: Commit**

```bash
git add src/app/api/cron/saturday-preview/route.ts
git commit -m "feat: auto-approve draft editions and mark published after distribution"
```

---

### Task 7: Admin Edition List — Status Badges and Review Banner

**Files:**
- Modify: `src/app/admin/editions/page.tsx`

**Step 1: Add status badge helper and needs-review banner**

Update `src/app/admin/editions/page.tsx`:

Add a status badge function:

```typescript
function statusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Draft</span>
    case 'approved':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Approved</span>
    case 'published':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Published</span>
    default:
      return null
  }
}
```

Add a "Needs Review" banner before the table:

```typescript
const hasDrafts = typedEditions.some(e => e.status === 'draft')

// Render before the table:
{hasDrafts && (
  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    <strong>Needs Review:</strong> There are draft editions awaiting your approval.
  </div>
)}
```

Add a Status column to the table header and rows:

```typescript
// Header:
<th className="py-2 pr-4">Status</th>

// Row:
<td className="py-3 pr-4">{statusBadge(edition.status)}</td>
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/app/admin/editions/page.tsx
git commit -m "feat: add status badges and needs-review banner to admin editions list"
```

---

### Task 8: Edition Editor — Approve Button and Status Display

**Files:**
- Modify: `src/components/admin/EditionEditor.tsx`

**Step 1: Add status display and approve button**

In the `EditionEditor` component:

Add approve handler:

```typescript
const [approving, setApproving] = useState(false)

async function handleApprove() {
  setApproving(true)
  try {
    const res = await fetch(`/api/admin/editions/${edition.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    if (!res.ok) {
      const data = await res.json()
      alert(`Approve failed: ${data.error ?? 'Unknown error'}`)
      return
    }
    const updated = await res.json()
    setEdition(updated)
  } catch (err) {
    alert(`Approve failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  } finally {
    setApproving(false)
  }
}
```

Add status badge next to the title (reuse same badge styles from Task 7):

```typescript
function statusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Draft</span>
    case 'approved':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Approved</span>
    case 'published':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Published</span>
    default:
      return null
  }
}
```

In the header section (next to Edition #N), add:

```typescript
<div className="flex items-center gap-3">
  <h1 className="text-2xl font-bold">Edition #{edition.issue_number}</h1>
  {statusBadge(edition.status)}
</div>
```

Add approve button in the button group (only for draft editions):

```typescript
{edition.status === 'draft' && (
  <button
    onClick={handleApprove}
    disabled={saving || regenerating || approving}
    className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {approving ? 'Approving...' : 'Approve Edition'}
  </button>
)}
```

If the edition is already approved, show who approved and when:

```typescript
{edition.status === 'approved' && (
  <p className="text-sm text-green-700 mt-1">
    {edition.approved_by
      ? `Approved on ${new Date(edition.approved_at!).toLocaleDateString()}`
      : 'Auto-approved'}
  </p>
)}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/components/admin/EditionEditor.tsx
git commit -m "feat: add approve button and status display to edition editor"
```

---

### Task 9: Final Build Verification

**Step 1: Full build**

Run: `npx next build`
Expected: Compiles with no errors

**Step 2: Manual test checklist**

1. Sign up, set `is_admin = true` manually in DB: `psql postgresql://postgres:postgres@127.0.0.1:54332/postgres -c "UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';"`
2. Visit `/admin/editions` — should load (non-admin should get redirected)
3. Generate an edition — should create with `status = 'draft'`
4. Edition list shows "Needs Review" banner and amber "Draft" badge
5. Edition editor shows "Draft" badge and "Approve Edition" button
6. Click "Approve Edition" — status changes to "Approved", badge turns green
7. Non-admin user visiting `/admin/editions` gets redirected

**Step 3: Commit any remaining fixes**
