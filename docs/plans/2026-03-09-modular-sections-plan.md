# Modular Newsletter Sections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users configure which of 7 section types (6 presets + 1 custom) appear in their newsletter, with a max of 6 active at a time, persisted in their profile settings.

**Architecture:** Add `enabled_sections`, `custom_section_title`, and `custom_section_prompt` to the profiles table. Add `custom` as a valid `section_type`. Update `getDefaultSections()` to respect user preferences. Generate custom section content per-user via Haiku at paper creation time. Add section configuration UI to the Settings page.

**Tech Stack:** Supabase migrations, Next.js API routes, React, Anthropic SDK (Haiku)

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/006_modular_sections.sql`

**Step 1: Write migration**

```sql
-- Modular sections: user-configurable section preferences + custom section type

-- Add section preferences to profiles
alter table public.profiles
  add column enabled_sections text[] not null default '{this_week,coaching,fun_zone,brain_fuel,chores}',
  add column custom_section_title text,
  add column custom_section_prompt text;

-- Allow 'custom' as a section type in paper_sections
-- Must drop and recreate the check constraint
alter table public.paper_sections
  drop constraint paper_sections_section_type_check;

alter table public.paper_sections
  add constraint paper_sections_section_type_check
    check (section_type in (
      'this_week', 'meal_plan', 'chores', 'coaching', 'fun_zone', 'brain_fuel', 'custom'
    ));
```

**Step 2: Apply migration**

Run: `npx supabase db reset`
Expected: All migrations apply cleanly

**Step 3: Commit**

```bash
git add supabase/migrations/006_modular_sections.sql
git commit -m "feat: add modular sections schema (enabled_sections + custom type)"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types/database.ts`

**Step 1: Add `custom` to SectionType**

Change the `SectionType` union at line 36-42 from:

```typescript
export type SectionType =
  | 'this_week'
  | 'meal_plan'
  | 'chores'
  | 'coaching'
  | 'fun_zone'
  | 'brain_fuel'
```

to:

```typescript
export type SectionType =
  | 'this_week'
  | 'meal_plan'
  | 'chores'
  | 'coaching'
  | 'fun_zone'
  | 'brain_fuel'
  | 'custom'
```

**Step 2: Add new fields to Profile**

Add these fields to the `Profile` type (after `is_admin`):

```typescript
  enabled_sections: SectionType[]
  custom_section_title: string | null
  custom_section_prompt: string | null
```

**Step 3: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "feat: add custom section type and profile section preferences"
```

---

### Task 3: Update getDefaultSections to Respect Preferences

**Files:**
- Modify: `src/lib/papers.ts:24-95`

**Step 1: Update getDefaultSections signature and logic**

Change `getDefaultSections` to accept `enabledSections` parameter. Only return sections that are in the user's enabled list. Add the custom section entry.

```typescript
export function getDefaultSections(
  edition?: WeeklyEdition | null,
  enabledSections: SectionType[] = ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'],
  customTitle?: string | null,
): Array<{
  section_type: SectionType
  content: Record<string, unknown>
  enabled: boolean
  overridden: boolean
}> {
  const hasEdition = !!edition

  const allSections: Array<{
    section_type: SectionType
    content: Record<string, unknown>
    enabled: boolean
    overridden: boolean
  }> = [
    {
      section_type: 'this_week',
      content: hasEdition && edition.sections.this_week
        ? { items: edition.sections.this_week.items }
        : { items: [] },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'meal_plan',
      content: {
        meals: {
          sunday: { breakfast: '', lunch: '', dinner: '' },
          monday: { breakfast: '', lunch: '', dinner: '' },
          tuesday: { breakfast: '', lunch: '', dinner: '' },
          wednesday: { breakfast: '', lunch: '', dinner: '' },
          thursday: { breakfast: '', lunch: '', dinner: '' },
          friday: { breakfast: '', lunch: '', dinner: '' },
          saturday: { breakfast: '', lunch: '', dinner: '' },
        },
      },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'chores',
      content: {
        items: [
          { text: 'Make your bed every morning', assignee: null },
          { text: 'Put clean laundry away', assignee: null },
          { text: 'Rinse your dishes after meals', assignee: null },
          { text: 'Clean your room once this week', assignee: null },
        ],
      },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'coaching',
      content: hasEdition && edition.sections.coaching
        ? { generated: true, content: edition.sections.coaching }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'fun_zone',
      content: hasEdition && edition.sections.fun_zone
        ? { generated: true, content: edition.sections.fun_zone }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'brain_fuel',
      content: hasEdition && edition.sections.brain_fuel
        ? { generated: true, content: edition.sections.brain_fuel }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'custom',
      content: { generated: false, content: { title: customTitle ?? 'Custom', body: '' } },
      enabled: true,
      overridden: false,
    },
  ]

  return allSections.filter(s => enabledSections.includes(s.section_type))
}
```

**Step 2: Update callers of getDefaultSections**

In `src/lib/papers.ts:getOrCreateCurrentPaper` (line 120-127), fetch the profile's `enabled_sections` and `custom_section_title` and pass them:

```typescript
// Before the getDefaultSections call, fetch profile preferences
const { data: profile } = await supabase
  .from('profiles')
  .select('enabled_sections, custom_section_title')
  .eq('id', userId)
  .single()

const sections = getDefaultSections(
  edition,
  profile?.enabled_sections ?? ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'],
  profile?.custom_section_title,
).map(s => ({
  ...s,
  paper_id: paper.id,
}))
```

In `src/app/api/cron/saturday-preview/route.ts` (line 96-101), similarly pass the profile's preferences:

```typescript
const sections = getDefaultSections(
  edition,
  profile.enabled_sections ?? ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'],
  profile.custom_section_title,
).map(s => ({
  ...s,
  paper_id: paper!.id,
}))
```

**Step 3: Commit**

```bash
git add src/lib/papers.ts src/app/api/cron/saturday-preview/route.ts
git commit -m "feat: getDefaultSections respects user's enabled_sections preference"
```

---

### Task 4: Generate Custom Section Content

**Files:**
- Modify: `src/app/api/generate-paper/route.ts:44-100`
- Modify: `src/lib/ai/content.ts:29-44`

**Step 1: Add custom section to AI content generation types**

In `src/app/api/generate-paper/route.ts`, update the `aiSectionTypes` array to include `'custom'`:

```typescript
const aiSectionTypes = ['coaching', 'fun_zone', 'brain_fuel', 'custom']
```

**Step 2: Update content prompt for custom sections**

The `buildContentPrompt` function in `src/lib/ai/content.ts` already has a `default` case (line 42-43) that handles unknown section types generically:

```typescript
default:
  return `Write a short piece for a family newsletter section called "${sectionType}". ${tone} ${brevity} Return JSON: {"title": "...", "body": "..."}${historyBlock}`
```

This needs to be updated to accept a custom prompt. Add a `customPrompt` parameter:

```typescript
export function buildContentPrompt(
  sectionType: string,
  audience: Audience | Audience[],
  pastContent?: string,
  customPrompt?: string,
): string {
```

Update the default case:

```typescript
default:
  if (customPrompt) {
    return `Write content for a family newsletter section. Instructions from the user: "${customPrompt}". ${tone} ${brevity} Return JSON: {"title": "...", "body": "..."}${historyBlock}`
  }
  return `Write a short piece for a family newsletter section called "${sectionType}". ${tone} ${brevity} Return JSON: {"title": "...", "body": "..."}${historyBlock}`
```

Update `generateContent` to pass through `customPrompt`:

```typescript
export async function generateContent(
  sectionType: string,
  audience: Audience | Audience[] = ['kids'],
  pastContent?: string,
  customPrompt?: string,
): Promise<{ title: string; body: string }> {
  const prompt = buildContentPrompt(sectionType, audience, pastContent, customPrompt)
  // ... rest unchanged
}
```

**Step 3: Pass custom prompt during paper generation**

In `src/app/api/generate-paper/route.ts`, update the profile select to include custom section fields:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('family_name, audience, intranet_url, custom_section_prompt')
  .eq('id', user.id)
  .single()
```

In the content generation loop (line 72-80), pass the custom prompt for custom sections:

```typescript
for (const section of sectionsToGenerate) {
  const customPrompt = section.section_type === 'custom'
    ? profile?.custom_section_prompt ?? undefined
    : undefined
  contentPromises.push(
    generateContent(section.section_type, audience, undefined, customPrompt).then(async (content) => {
      await supabase
        .from('paper_sections')
        .update({ content: { generated: true, content } })
        .eq('id', section.id)
    })
  )
}
```

**Step 4: Commit**

```bash
git add src/lib/ai/content.ts src/app/api/generate-paper/route.ts
git commit -m "feat: generate custom section content using user's prompt"
```

---

### Task 5: Update Dashboard Editor for Custom Sections

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx:16-32`

**Step 1: Add custom to SECTION_ORDER and SECTION_META**

Update the constants:

```typescript
const SECTION_ORDER: SectionType[] = [
  'this_week',
  'meal_plan',
  'chores',
  'coaching',
  'fun_zone',
  'brain_fuel',
  'custom',
]

const SECTION_META: Record<SectionType, { emoji: string; label: string }> = {
  this_week: { emoji: '📅', label: 'This Week' },
  meal_plan: { emoji: '🍽️', label: 'Meal Plan' },
  chores: { emoji: '🧹', label: 'Chores' },
  coaching: { emoji: '💪', label: 'Parent Coaching' },
  fun_zone: { emoji: '🎉', label: 'Fun Zone' },
  brain_fuel: { emoji: '🧠', label: 'Brain Fuel' },
  custom: { emoji: '✨', label: 'Custom' },
}
```

Note: The `custom` label here is a fallback. The actual title is in the section's content. The existing `GeneratedContentEditor` component already renders `{ title, body }` content, so custom sections will work with the same editor — no new editor needed.

**Step 2: Update the custom label dynamically**

In the section rendering loop, when displaying the section header for a custom section, use the content's title instead of the static label:

Find where `SECTION_META[section.section_type].label` is used in the section header and add a conditional:

```typescript
const label = section.section_type === 'custom'
  ? ((section.content as any)?.content?.title || 'Custom')
  : SECTION_META[section.section_type].label
```

**Step 3: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat: add custom section support to dashboard editor"
```

---

### Task 6: Update Chat System Prompt

**Files:**
- Modify: `src/lib/ai/chat.ts:12-19`
- Modify: `src/app/api/chat/route.ts`

**Step 1: Add custom section to chat system prompt**

In `src/lib/ai/chat.ts`, update `buildChatSystemPrompt` to accept custom section info and add it to the available sections list:

```typescript
export function buildChatSystemPrompt(
  pastContentSummary?: string,
  customSectionTitle?: string | null,
): string {
```

In the "Available sections:" list, add (conditionally, only if user has a custom section):

```typescript
const customSectionDoc = customSectionTitle
  ? `\n- "custom" — ${customSectionTitle}. Content shape: {"generated": true, "content": {"title": "...", "body": "..."}}`
  : ''
```

Insert `customSectionDoc` after the brain_fuel line in the system prompt.

**Step 2: Pass custom title from chat route**

In `src/app/api/chat/route.ts`, update the profile select to include `custom_section_title`:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('..., custom_section_title')
```

Pass it to `buildChatSystemPrompt`:

```typescript
const systemPrompt = buildChatSystemPrompt(pastContentSummary, profile?.custom_section_title)
```

**Step 3: Commit**

```bash
git add src/lib/ai/chat.ts src/app/api/chat/route.ts
git commit -m "feat: add custom section to chat system prompt"
```

---

### Task 7: Settings UI — Section Configuration

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

**Step 1: Add section preference state**

Add state variables and constants:

```typescript
const MAX_SECTIONS = 6

const ALL_SECTIONS = [
  { type: 'this_week', label: 'This Week', emoji: '📅' },
  { type: 'meal_plan', label: 'Meal Plan', emoji: '🍽️' },
  { type: 'chores', label: 'Chores', emoji: '🧹' },
  { type: 'coaching', label: 'Parent Coaching', emoji: '💪' },
  { type: 'fun_zone', label: 'Fun Zone', emoji: '🎉' },
  { type: 'brain_fuel', label: 'Brain Fuel', emoji: '🧠' },
  { type: 'custom', label: 'Custom', emoji: '✨' },
] as const

const [enabledSections, setEnabledSections] = useState<string[]>(
  ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores']
)
const [customTitle, setCustomTitle] = useState('')
const [customPrompt, setCustomPrompt] = useState('')
```

**Step 2: Load preferences from profile**

In the `loadProfile` function, update the select to include new fields:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('family_name, timezone, intranet_url, enabled_sections, custom_section_title, custom_section_prompt')
  .eq('id', user.id)
  .single()

if (profile) {
  // ... existing fields ...
  setEnabledSections(profile.enabled_sections ?? ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'])
  setCustomTitle(profile.custom_section_title ?? '')
  setCustomPrompt(profile.custom_section_prompt ?? '')
}
```

**Step 3: Save preferences**

In the `handleSave` function, include the new fields:

```typescript
await supabase
  .from('profiles')
  .update({
    family_name: familyName,
    timezone,
    intranet_url: intranetUrl.trim() || null,
    enabled_sections: enabledSections,
    custom_section_title: customTitle.trim() || null,
    custom_section_prompt: customPrompt.trim() || null,
  })
  .eq('id', user.id)
```

**Step 4: Render section toggles UI**

Add a new card below the existing form (or as a new section within it), before the Save button:

```tsx
{/* Newsletter Sections */}
<div className="mb-6">
  <label className="mb-2 block text-sm font-medium text-stone-700">
    Newsletter Sections
    <span className="ml-2 text-xs font-normal text-stone-400">
      ({enabledSections.length}/{MAX_SECTIONS} active)
    </span>
  </label>
  <div className="space-y-2">
    {ALL_SECTIONS.map(({ type, label, emoji }) => {
      const isEnabled = enabledSections.includes(type)
      const atMax = enabledSections.length >= MAX_SECTIONS && !isEnabled

      return (
        <div key={type}>
          <label
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              isEnabled
                ? 'border-amber-300 bg-amber-50'
                : atMax
                  ? 'border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed'
                  : 'border-stone-200 bg-white cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={isEnabled}
              disabled={atMax}
              onChange={(e) => {
                if (e.target.checked) {
                  setEnabledSections(prev => [...prev, type])
                } else {
                  setEnabledSections(prev => prev.filter(s => s !== type))
                }
              }}
              className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-base">{emoji}</span>
            <span className="text-sm font-medium text-stone-700">{label}</span>
          </label>

          {/* Custom section fields — show inline when custom is enabled */}
          {type === 'custom' && isEnabled && (
            <div className="ml-10 mt-2 space-y-2">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Section title (e.g. Bible Verse)"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what content to generate (e.g. Find a relevant bible verse and write a short family reflection)"
                rows={2}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
          )}
        </div>
      )
    })}
  </div>
</div>
```

**Step 5: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat: add section configuration UI to settings page"
```

---

### Task 8: Update Regenerate API for Custom Sections

**Files:**
- Modify: `src/app/api/generate/route.ts`

**Step 1: Pass custom prompt when regenerating a custom section**

Read the file first. When a user clicks "Regenerate with AI" on a custom section in the advanced editor, the `/api/generate` route handles it. Update this route to fetch the user's `custom_section_prompt` and pass it to `generateContent` when the section type is `custom`:

```typescript
// Update the profile select to include custom_section_prompt
const { data: profile } = await supabase
  .from('profiles')
  .select('..., custom_section_prompt')
  .eq('id', user.id)
  .single()

// When calling generateContent for custom type:
const customPrompt = sectionType === 'custom'
  ? profile?.custom_section_prompt ?? undefined
  : undefined
const content = await generateContent(sectionType, ages ?? [], pastContent, customPrompt)
```

**Step 2: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: pass custom prompt when regenerating custom sections"
```

---

### Task 9: Final Build Verification

**Step 1: Full build**

Run: `npx next build`
Expected: Compiles with no errors

**Step 2: Manual test checklist**

1. `npx supabase db reset` — migrations apply cleanly
2. Sign up, visit `/dashboard/settings`
3. Section toggles appear with 5 of 7 enabled (this_week, coaching, fun_zone, brain_fuel, chores)
4. Toggle on Custom — title and description fields appear
5. Fill in title: "Bible Verse", description: "Find a weekly bible verse with a short family reflection"
6. Toggle on Meal Plan — should work (now at 6/6, Custom toggle shows as disabled if you try)
7. Try toggling a 7th section — checkbox should be greyed out
8. Save settings
9. Go to `/paper` — paper should generate with enabled sections only
10. Custom section should have AI-generated bible verse content
11. Advanced editor should show the custom section with `GeneratedContentEditor`
12. Regenerate on custom section should produce new content

**Step 3: Commit any remaining fixes**
