# Shared Weekly Editions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-user AI content generation with a single shared weekly edition, enabling instant signup UX and drastically reducing token costs.

**Architecture:** New `weekly_editions` table stores one pre-generated edition per week. Paper creation populates `paper_sections` from the shared edition. Chat edits mark sections as `overridden` so they aren't refreshed. A Friday night cron generates next week's edition.

**Tech Stack:** Supabase (Postgres migration), Next.js API routes, Anthropic SDK (Haiku for content, Sonnet for composition), Vitest for tests.

---

### Task 1: Database Migration — `weekly_editions` table + `overridden` column

**Files:**
- Create: `supabase/migrations/003_shared_editions.sql`

**Step 1: Write the migration**

```sql
-- Shared weekly editions: one AI-generated edition per week for all users
create table public.weekly_editions (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  sections jsonb not null default '{}'::jsonb,
  composed_html text,
  issue_number integer not null default 1,
  created_at timestamptz not null default now()
);

-- Allow all authenticated users to read shared editions
alter table public.weekly_editions enable row level security;
create policy "Anyone can read editions"
  on public.weekly_editions for select
  to authenticated
  using (true);

-- Only service role can insert/update (no user policy for insert/update)

-- Track per-user overrides on sections
alter table public.paper_sections
  add column overridden boolean not null default false;
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset`
Expected: All migrations apply cleanly, tables recreated.

**Step 3: Commit**

```bash
git add supabase/migrations/003_shared_editions.sql
git commit -m "feat: add weekly_editions table and overridden column"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types/database.ts`

**Step 1: Add WeeklyEdition type**

Add after the existing `GeneratedContent` type at the end of the file:

```typescript
export type WeeklyEdition = {
  id: string
  week_start: string
  sections: {
    coaching?: { title: string; body: string }
    fun_zone?: { title: string; body: string }
    brain_fuel?: { title: string; body: string }
    this_week?: { items: Array<{ text: string; icon?: string }> }
  }
  composed_html: string | null
  issue_number: number
  created_at: string
}
```

**Step 2: Update PaperSection type to include `overridden`**

Find the `PaperSection` type and add `overridden: boolean` field.

**Step 3: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "feat: add WeeklyEdition type and overridden field to PaperSection"
```

---

### Task 3: Shared Edition Generation Function

**Files:**
- Create: `src/lib/editions.ts`
- Test: `src/lib/__tests__/editions.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AI modules
vi.mock('@/lib/ai/content', () => ({
  generateContent: vi.fn().mockResolvedValue({ title: 'Test Title', body: 'Test body' }),
  generateThisWeekContent: vi.fn().mockResolvedValue({ items: [{ text: 'Test item', icon: '📅' }] }),
}))

vi.mock('@/lib/ai/compose', () => ({
  composeNewsletter: vi.fn().mockResolvedValue('<html>test</html>'),
}))

import { generateSharedEdition } from '../editions'
import { generateContent, generateThisWeekContent } from '@/lib/ai/content'
import { composeNewsletter } from '@/lib/ai/compose'

describe('generateSharedEdition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates content for all AI sections in parallel', async () => {
    const result = await generateSharedEdition('2026-03-08')

    expect(generateContent).toHaveBeenCalledWith('coaching', ['kids', 'pre-teens', 'teens'])
    expect(generateContent).toHaveBeenCalledWith('fun_zone', ['kids', 'pre-teens', 'teens'])
    expect(generateContent).toHaveBeenCalledWith('brain_fuel', ['kids', 'pre-teens', 'teens'])
    expect(generateThisWeekContent).toHaveBeenCalledWith(['kids', 'pre-teens', 'teens'])
  })

  it('returns sections object with all generated content', async () => {
    const result = await generateSharedEdition('2026-03-08')

    expect(result.sections).toHaveProperty('coaching')
    expect(result.sections).toHaveProperty('fun_zone')
    expect(result.sections).toHaveProperty('brain_fuel')
    expect(result.sections).toHaveProperty('this_week')
    expect(result.sections.coaching).toEqual({ title: 'Test Title', body: 'Test body' })
  })

  it('composes HTML with generic family name and no review loop', async () => {
    const result = await generateSharedEdition('2026-03-08')

    expect(composeNewsletter).toHaveBeenCalledWith(
      { family_name: 'Our Family', audience: ['kids', 'pre-teens', 'teens'] },
      expect.any(Array),
      '2026-03-08',
      undefined,
      { reviewLayout: true }
    )
    expect(result.composed_html).toBe('<html>test</html>')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/editions.test.ts`
Expected: FAIL — `generateSharedEdition` not found.

**Step 3: Write the implementation**

Create `src/lib/editions.ts`:

```typescript
import { generateContent, generateThisWeekContent } from '@/lib/ai/content'
import { composeNewsletter } from '@/lib/ai/compose'
import type { WeeklyEdition } from '@/lib/types/database'

/** Default audience for shared editions — broad enough for most families */
const SHARED_AUDIENCE = ['kids', 'pre-teens', 'teens'] as const

type EditionSections = WeeklyEdition['sections']

/**
 * Generate the shared weekly edition content + composed HTML.
 * Called by the Friday cron. Returns data ready to insert into weekly_editions.
 */
export async function generateSharedEdition(weekStart: string): Promise<{
  sections: EditionSections
  composed_html: string
}> {
  // Generate all AI content in parallel
  const [coaching, funZone, brainFuel, thisWeek] = await Promise.all([
    generateContent('coaching', [...SHARED_AUDIENCE]),
    generateContent('fun_zone', [...SHARED_AUDIENCE]),
    generateContent('brain_fuel', [...SHARED_AUDIENCE]),
    generateThisWeekContent([...SHARED_AUDIENCE]),
  ])

  const sections: EditionSections = {
    coaching: coaching,
    fun_zone: funZone,
    brain_fuel: brainFuel,
    this_week: thisWeek,
  }

  // Build mock PaperSection array for the composer
  const paperSections = [
    { id: '', paper_id: '', section_type: 'this_week', content: { items: thisWeek.items }, enabled: true, overridden: false, created_at: '', updated_at: '' },
    { id: '', paper_id: '', section_type: 'chores', content: { items: [
      { text: 'Make your bed every morning' },
      { text: 'Put clean laundry away' },
      { text: 'Rinse your dishes after meals' },
      { text: 'Clean your room once this week' },
    ] }, enabled: true, overridden: false, created_at: '', updated_at: '' },
    { id: '', paper_id: '', section_type: 'coaching', content: { generated: true, content: coaching }, enabled: true, overridden: false, created_at: '', updated_at: '' },
    { id: '', paper_id: '', section_type: 'fun_zone', content: { generated: true, content: funZone }, enabled: true, overridden: false, created_at: '', updated_at: '' },
    { id: '', paper_id: '', section_type: 'brain_fuel', content: { generated: true, content: brainFuel }, enabled: true, overridden: false, created_at: '', updated_at: '' },
  ]

  const composed_html = await composeNewsletter(
    { family_name: 'Our Family', audience: [...SHARED_AUDIENCE] },
    paperSections as any,
    weekStart,
    undefined,
    { reviewLayout: true }
  )

  return { sections, composed_html }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/editions.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/lib/editions.ts src/lib/__tests__/editions.test.ts
git commit -m "feat: add generateSharedEdition function"
```

---

### Task 4: Update `getOrCreateCurrentPaper` to Use Shared Editions

**Files:**
- Modify: `src/lib/papers.ts`

**Step 1: Read the current file**

Read `src/lib/papers.ts` to see exact current implementation.

**Step 2: Add helper to fetch shared edition**

Add this function to `src/lib/papers.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WeeklyEdition } from '@/lib/types/database'

/** Fetch the shared edition for a given week, if it exists */
async function getSharedEdition(supabase: SupabaseClient, weekStart: string): Promise<WeeklyEdition | null> {
  const { data } = await supabase
    .from('weekly_editions')
    .select('*')
    .eq('week_start', weekStart)
    .single()
  return data
}
```

**Step 3: Modify `getDefaultSections` to accept optional shared edition**

Update `getDefaultSections()` to accept an optional `WeeklyEdition` parameter. When provided, populate AI sections from the shared edition instead of empty defaults:

```typescript
function getDefaultSections(paperId: string, edition?: WeeklyEdition | null) {
  const sections = [
    {
      paper_id: paperId,
      section_type: 'this_week',
      content: edition?.sections?.this_week
        ? { items: edition.sections.this_week.items }
        : { items: [] },
      enabled: true,
      overridden: false,
    },
    {
      paper_id: paperId,
      section_type: 'meal_plan',
      content: { meals: {} },
      enabled: false,
      overridden: false,
    },
    {
      paper_id: paperId,
      section_type: 'chores',
      content: { items: [
        { text: 'Make your bed every morning' },
        { text: 'Put clean laundry away' },
        { text: 'Rinse your dishes after meals' },
        { text: 'Clean your room once this week' },
      ] },
      enabled: true,
      overridden: false,
    },
    {
      paper_id: paperId,
      section_type: 'coaching',
      content: edition?.sections?.coaching
        ? { generated: true, content: edition.sections.coaching }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      paper_id: paperId,
      section_type: 'fun_zone',
      content: edition?.sections?.fun_zone
        ? { generated: true, content: edition.sections.fun_zone }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      paper_id: paperId,
      section_type: 'brain_fuel',
      content: edition?.sections?.brain_fuel
        ? { generated: true, content: edition.sections.brain_fuel }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
  ]
  return sections
}
```

**Step 4: Update `getOrCreateCurrentPaper` to fetch shared edition**

In the section where a new paper is created and default sections are inserted, add the shared edition lookup:

```typescript
// Before inserting sections:
const edition = await getSharedEdition(supabase, weekStart)
const sections = getDefaultSections(paper.id, edition)
```

This way, if a shared edition exists, all AI sections come pre-populated. If not (edge case), they start empty and fall back to per-user generation as before.

**Step 5: Run tests and verify build**

Run: `npm test && npm run build`
Expected: All tests pass, build succeeds.

**Step 6: Commit**

```bash
git add src/lib/papers.ts
git commit -m "feat: populate new papers from shared weekly edition"
```

---

### Task 5: Friday Cron — Generate Edition

**Files:**
- Create: `src/app/api/cron/generate-edition/route.ts`

**Step 1: Write the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSharedEdition } from '@/lib/editions'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role to write to weekly_editions
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Calculate next week's Sunday
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysUntilSunday = (7 - dayOfWeek) % 7 || 7
  const nextSunday = new Date(now)
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday)
  const weekStart = nextSunday.toISOString().split('T')[0]

  // Check if edition already exists
  const { data: existing } = await supabase
    .from('weekly_editions')
    .select('id')
    .eq('week_start', weekStart)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Edition already exists', weekStart })
  }

  // Get next issue number
  const { data: latest } = await supabase
    .from('weekly_editions')
    .select('issue_number')
    .order('issue_number', { ascending: false })
    .limit(1)
    .single()

  const issueNumber = (latest?.issue_number ?? 0) + 1

  console.log(`[generate-edition] Generating edition for ${weekStart} (issue #${issueNumber})`)

  const { sections, composed_html } = await generateSharedEdition(weekStart)

  const { error } = await supabase
    .from('weekly_editions')
    .insert({
      week_start: weekStart,
      sections,
      composed_html,
      issue_number: issueNumber,
    })

  if (error) {
    console.error('[generate-edition] Insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[generate-edition] Edition #${issueNumber} for ${weekStart} generated successfully`)
  return NextResponse.json({ weekStart, issueNumber })
}
```

**Step 2: Test manually**

Run: `source .env.local && curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/generate-edition`
Expected: JSON response with `weekStart` and `issueNumber`. Check `weekly_editions` table has a row.

**Step 3: Commit**

```bash
git add src/app/api/cron/generate-edition/route.ts
git commit -m "feat: add Friday cron to generate shared weekly edition"
```

---

### Task 6: Mark Sections as Overridden on Chat Edit

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Step 1: Read the current file**

Read `src/app/api/chat/route.ts` to see exact update logic.

**Step 2: Add `overridden: true` to section updates**

In the chat route, wherever sections are updated in the database (the `.update()` calls inside the update loop), add `overridden: true` to the update payload.

Find the section update code (around lines 62-94) and for each `.update()` call, include `overridden: true` alongside the `content` update. For example:

```typescript
await supabase
  .from('paper_sections')
  .update({ content: mergedContent, overridden: true })
  .eq('id', section.id)
```

Do this for both the 'replace' and 'merge' code paths.

**Step 3: Run build to verify no type errors**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: mark sections as overridden on chat edit"
```

---

### Task 7: Update Saturday Cron to Refresh Non-Overridden Sections

**Files:**
- Modify: `src/app/api/cron/saturday-preview/route.ts`

**Step 1: Read the current file**

Read `src/app/api/cron/saturday-preview/route.ts`.

**Step 2: Add shared edition refresh logic**

After getting/creating the paper and its sections, but before composing HTML:

1. Fetch the shared edition for the current week
2. For each AI section (coaching, fun_zone, brain_fuel, this_week) where `overridden === false`:
   - Update the section content from the shared edition
3. Skip sections where `overridden === true`

Add this logic:

```typescript
// Refresh non-overridden sections from shared edition
const { data: edition } = await supabase
  .from('weekly_editions')
  .select('*')
  .eq('week_start', weekStart)
  .single()

if (edition) {
  const sectionMap: Record<string, any> = {
    coaching: edition.sections.coaching ? { generated: true, content: edition.sections.coaching } : null,
    fun_zone: edition.sections.fun_zone ? { generated: true, content: edition.sections.fun_zone } : null,
    brain_fuel: edition.sections.brain_fuel ? { generated: true, content: edition.sections.brain_fuel } : null,
    this_week: edition.sections.this_week ? { items: edition.sections.this_week.items } : null,
  }

  for (const section of sections) {
    if (!section.overridden && sectionMap[section.section_type]) {
      await supabase
        .from('paper_sections')
        .update({ content: sectionMap[section.section_type] })
        .eq('id', section.id)
    }
  }
}
```

**Step 3: Remove per-user AI generation from Saturday cron**

The Saturday cron currently calls `generateContent()` per user for empty AI sections. Remove that block — if a shared edition exists, sections are already populated. If no shared edition (edge case), leave sections as-is (the Friday cron should have run).

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/api/cron/saturday-preview/route.ts
git commit -m "feat: Saturday cron refreshes non-overridden sections from shared edition"
```

---

### Task 8: Update Generate-Paper Route to Skip AI When Shared Edition Used

**Files:**
- Modify: `src/app/api/generate-paper/route.ts`

**Step 1: Read the current file**

Read `src/app/api/generate-paper/route.ts`.

**Step 2: Add early return when sections already generated from shared edition**

The existing check on lines 28-41 already looks for `generated === true` on AI sections. Since papers created from a shared edition will have `generated: true` in their content, this check should already work — the route will skip AI generation and go straight to composition.

Verify this is the case. If the check works correctly, no code changes needed — just verify and document.

If the check doesn't cover `this_week` (which has a different structure), ensure that section is also handled.

**Step 3: The composition step still runs** — this is correct because it needs the user's family name and issue number. But pass `{ reviewLayout: false }` since the shared edition's HTML was already QA'd.

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit (if changes were needed)**

```bash
git add src/app/api/generate-paper/route.ts
git commit -m "feat: skip AI generation when sections from shared edition"
```

---

### Task 9: Update PaperView to Handle Pre-Populated Papers

**Files:**
- Modify: `src/app/paper/PaperView.tsx`

**Step 1: Read the current file**

Read `src/app/paper/PaperView.tsx`.

**Step 2: Update the `generating` detection logic**

Currently `PaperView` checks if AI sections need generation and shows a spinner. With shared editions, AI sections may already be populated. Update the check:

The `generating` state is likely initialized by checking if coaching/fun_zone/brain_fuel sections have `generated === true`. If sections come pre-populated from the shared edition, `generated` will be `true` and `generating` should be `false` — meaning no spinner, instant display.

Verify this is the case. If the paper has pre-populated sections but no `composed_html` yet (because composition with the user's family name hasn't happened), we need to trigger composition but NOT content generation.

Add logic: if sections are generated but `composed_html` is null, call `/api/compose` (fast, ~5-10s) instead of `/api/generate-paper` (slow, generates content + composes).

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/paper/PaperView.tsx
git commit -m "feat: PaperView handles pre-populated shared edition papers"
```

---

### Task 10: End-to-End Manual Test

**Step 1: Reset local database**

Run: `npx supabase db reset`

**Step 2: Generate a shared edition for this week**

Run: `source .env.local && curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/generate-edition`
Expected: JSON with `weekStart` and `issueNumber`.

**Step 3: Verify shared edition in database**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" -c "SELECT week_start, issue_number, length(composed_html) as html_len FROM weekly_editions;"`
Expected: One row with HTML content.

**Step 4: Sign up a new user**

1. Open `http://localhost:3000/signup`
2. Create account, complete onboarding
3. Verify /paper loads with pre-populated content (no long AI wait)
4. Verify newsletter preview shows shared edition content

**Step 5: Test chat override**

1. In chat, type "make the coaching about teamwork"
2. Verify coaching section updates
3. Check database: `paper_sections.overridden` should be `true` for coaching

**Step 6: Commit any fixes and final cleanup**

```bash
git add -A
git commit -m "feat: shared weekly editions — complete implementation"
```
