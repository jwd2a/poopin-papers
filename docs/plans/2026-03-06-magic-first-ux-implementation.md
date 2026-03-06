# Magic-First UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace editor-first UX with a single-screen newsletter + chat sidebar experience where signup immediately delivers a ready-to-print issue.

**Architecture:** The main authenticated view becomes `/paper` -- a server component that gets/creates the current paper (with auto-composed HTML), rendered as a split layout: newsletter iframe (left) + chat sidebar (right). A new `/api/chat` route uses Haiku to parse user messages into section data updates, then triggers a background re-compose via Sonnet. Signup redirects directly to `/paper` instead of onboarding.

**Tech Stack:** Next.js App Router, Supabase, Anthropic SDK (Haiku for chat parsing + content gen, Sonnet for composition), existing PDF/email infrastructure unchanged.

**Design doc:** `docs/plans/2026-03-06-magic-first-ux-design.md`

---

## Task 1: Update Signup to Skip Onboarding + Auto-Detect Timezone

**Files:**
- Modify: `src/app/signup/page.tsx`
- Modify: `src/lib/supabase/middleware.ts`

**Step 1: Update signup redirect**

In `src/app/signup/page.tsx`, change line 35 from:
```typescript
router.push('/onboarding')
```
to:
```typescript
router.push('/paper')
```

**Step 2: Add timezone auto-detection to signup**

In `src/app/signup/page.tsx`, after the `supabase.auth.signUp()` call succeeds, update the profile with the detected timezone:

```typescript
// After successful signup, set timezone from browser
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
const { data: { user: newUser } } = await supabase.auth.getUser()
if (newUser) {
  await supabase.from('profiles').update({ timezone }).eq('id', newUser.id)
}
```

**Step 3: Update middleware redirect for authenticated users**

In `src/lib/supabase/middleware.ts`, change the authenticated user redirect (line 40) from `/dashboard` to `/paper`:

```typescript
if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
  const url = request.nextUrl.clone()
  url.pathname = '/paper'
  return NextResponse.redirect(url)
}
```

**Step 4: Update login redirect**

In `src/app/login/page.tsx`, change the post-login redirect from `/dashboard` to `/paper`.

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: skip onboarding, redirect to /paper, auto-detect timezone"
```

---

## Task 2: Auto-Compose on First Paper Creation

**Files:**
- Modify: `src/lib/papers.ts`
- Modify: `src/lib/ai/content.ts`

**Step 1: Add "this_week" content generation to content.ts**

In `src/lib/ai/content.ts`, add a new case to `buildContentPrompt` for `this_week`:

```typescript
case 'this_week':
  return `Generate 3-4 items for the "This Week" section of a family bathroom newsletter for the week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Include seasonal or date-relevant items (holidays, weather, school events, daylight changes, etc). Each item should be a short, actionable or fun note. Return JSON: {"items": [{"text": "...", "icon": "emoji"}, ...]}`
```

Also add a `generateThisWeekContent` export:

```typescript
export async function generateThisWeekContent(): Promise<{ items: Array<{ text: string; icon?: string }> }> {
  const prompt = buildContentPrompt('this_week', [])

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')
  return JSON.parse(jsonMatch[0])
}
```

**Step 2: Update getOrCreateCurrentPaper to auto-compose**

In `src/lib/papers.ts`, after the AI content generation loop (line ~120), add:

```typescript
// Also generate "This Week" items
const { generateThisWeekContent } = await import('@/lib/ai/content')
const thisWeekContent = await generateThisWeekContent()
const { data: thisWeekSection } = await supabase
  .from('paper_sections')
  .select('id')
  .eq('paper_id', paper.id)
  .eq('section_type', 'this_week')
  .single()

if (thisWeekSection) {
  await supabase
    .from('paper_sections')
    .update({ content: thisWeekContent })
    .eq('id', thisWeekSection.id)
}

// Auto-compose the newsletter
const { composeNewsletter } = await import('@/lib/ai/compose')
const { data: allSections } = await supabase
  .from('paper_sections')
  .select('*')
  .eq('paper_id', paper.id)

const { data: profile } = await supabase
  .from('profiles')
  .select('family_name')
  .eq('id', userId)
  .single()

if (allSections) {
  const html = await composeNewsletter(
    { family_name: profile?.family_name ?? null },
    allSections,
    weekStart
  )
  await supabase
    .from('papers')
    .update({ composed_html: html, status: 'preview' })
    .eq('id', paper.id)

  // Re-fetch to return updated paper with composed_html
  const { data: updatedPaper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paper.id)
    .single()

  if (updatedPaper) return updatedPaper as Paper
}
```

**Step 3: Run tests**

```bash
npm test
```

Existing pure function tests should still pass. The async function changes don't affect unit tests.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: auto-generate this_week content and auto-compose newsletter on first paper"
```

---

## Task 3: Chat API Route

**Files:**
- Create: `src/lib/ai/chat.ts`
- Create: `src/app/api/chat/route.ts`
- Test: `src/lib/ai/__tests__/chat.test.ts`

**Step 1: Write tests for chat intent parsing prompt**

Create `src/lib/ai/__tests__/chat.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildChatSystemPrompt } from '../chat'

describe('buildChatSystemPrompt', () => {
  it('includes all section types in the prompt', () => {
    const prompt = buildChatSystemPrompt()
    expect(prompt).toContain('meal_plan')
    expect(prompt).toContain('chores')
    expect(prompt).toContain('this_week')
    expect(prompt).toContain('coaching')
    expect(prompt).toContain('fun_zone')
    expect(prompt).toContain('brain_fuel')
  })

  it('specifies JSON output format', () => {
    const prompt = buildChatSystemPrompt()
    expect(prompt).toContain('JSON')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

**Step 3: Implement chat module**

Create `src/lib/ai/chat.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

function getClient() {
  return new Anthropic()
}

export function buildChatSystemPrompt(): string {
  return `You are an assistant that helps families edit their weekly newsletter called "Poopin' Papers."

When the user tells you something to add or change, determine which newsletter section(s) to update and return a JSON response.

Available sections:
- "this_week" — calendar items, events, reminders for the week. Content shape: {"items": [{"text": "...", "icon": "emoji"}]}
- "meal_plan" — meals for the week. Content shape: {"meals": {"monday": {"breakfast": "...", "lunch": "...", "dinner": "..."}, ...}}
- "chores" — chore checklist. Content shape: {"items": [{"text": "...", "assignee": "name or null"}]}
- "coaching" — motivational lesson. Content shape: {"generated": true, "content": {"title": "...", "body": "..."}}
- "fun_zone" — jokes and fun facts. Content shape: {"generated": true, "content": {"title": "...", "body": "..."}}
- "brain_fuel" — quote and brain teaser. Content shape: {"generated": true, "content": {"title": "...", "body": "..."}}

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "updates": [
    {
      "section_type": "the_section",
      "action": "merge" | "replace",
      "data": { ... the content to merge or replace ... }
    }
  ],
  "confirmation": "A friendly one-line confirmation of what you did"
}

For "merge" action on this_week and chores: append new items to existing items array.
For "merge" action on meal_plan: merge the provided days/meals into the existing meal plan.
For "replace" action: replace the entire section content.

If the user's message is unclear, ask a clarifying question instead:
{
  "updates": [],
  "confirmation": "Your clarifying question here"
}

Always be warm and playful in your confirmation messages.`
}

export type ChatUpdate = {
  section_type: string
  action: 'merge' | 'replace'
  data: Record<string, unknown>
}

export type ChatResponse = {
  updates: ChatUpdate[]
  confirmation: string
}

export async function processChatMessage(
  message: string,
  currentSections: Array<{ section_type: string; content: Record<string, unknown> }>
): Promise<ChatResponse> {
  const sectionContext = currentSections
    .map(s => `${s.section_type}: ${JSON.stringify(s.content)}`)
    .join('\n')

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: buildChatSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: `Current newsletter sections:\n${sectionContext}\n\nUser says: "${message}"`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { updates: [], confirmation: 'Sorry, I had trouble understanding that. Could you try again?' }
  }

  return JSON.parse(jsonMatch[0])
}
```

**Step 4: Create API route**

Create `src/app/api/chat/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { processChatMessage } from '@/lib/ai/chat'
import { composeNewsletter } from '@/lib/ai/compose'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { message, paperId } = await request.json()

  // Verify paper ownership
  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  // Get current sections
  const { data: sections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  if (!sections) {
    return NextResponse.json({ error: 'No sections found' }, { status: 404 })
  }

  // Process chat message
  const chatResponse = await processChatMessage(
    message,
    sections.map(s => ({ section_type: s.section_type, content: s.content as Record<string, unknown> }))
  )

  // Apply updates to sections
  for (const update of chatResponse.updates) {
    const section = sections.find(s => s.section_type === update.section_type)
    if (!section) continue

    let newContent: Record<string, unknown>

    if (update.action === 'replace') {
      newContent = update.data
    } else {
      // Merge: handle arrays (this_week items, chores items) and objects (meal_plan meals)
      const existing = section.content as Record<string, unknown>
      if (update.data.items && Array.isArray(update.data.items)) {
        const existingItems = (existing.items as unknown[]) || []
        newContent = { ...existing, items: [...existingItems, ...update.data.items] }
      } else if (update.data.meals) {
        const existingMeals = (existing.meals as Record<string, unknown>) || {}
        const newMeals = update.data.meals as Record<string, unknown>
        const merged: Record<string, unknown> = { ...existingMeals }
        for (const [day, meals] of Object.entries(newMeals)) {
          merged[day] = { ...(existingMeals[day] as Record<string, unknown> || {}), ...(meals as Record<string, unknown>) }
        }
        newContent = { ...existing, meals: merged }
      } else {
        newContent = { ...existing, ...update.data }
      }
    }

    await supabase
      .from('paper_sections')
      .update({ content: newContent })
      .eq('id', section.id)
  }

  // Return confirmation immediately, compose will be triggered by client
  return NextResponse.json({
    confirmation: chatResponse.confirmation,
    hasUpdates: chatResponse.updates.length > 0,
  })
}
```

**Step 5: Run tests**

```bash
npm test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add chat API route with AI-powered message parsing and section updates"
```

---

## Task 4: Re-Compose API Endpoint

**Files:**
- Modify: `src/app/api/compose/route.ts`

The existing compose route works but always requires a POST. We need to ensure it can be called from the client after chat updates. The current implementation is fine -- no changes needed to the route itself. The client will call it after chat messages.

This task is a no-op -- the existing `/api/compose` route handles this. Skip to Task 5.

---

## Task 5: Main Paper View (Single Screen)

**Files:**
- Create: `src/app/paper/page.tsx` (server component)
- Create: `src/app/paper/PaperView.tsx` (client component -- the single screen)
- Create: `src/app/paper/ChatSidebar.tsx` (client component -- chat sidebar)
- Create: `src/app/paper/layout.tsx` (layout with header)

**Step 1: Create paper layout**

Create `src/app/paper/layout.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PaperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen flex-col bg-stone-100">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <h1 className="font-serif text-xl font-bold text-stone-800">
          Poopin&apos; Papers
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Advanced Editor
          </Link>
          <Link
            href="/dashboard/settings"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Settings
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-stone-500 hover:text-stone-700">
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
```

**Step 2: Create paper page (server component)**

Create `src/app/paper/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateCurrentPaper } from '@/lib/papers'
import { PaperView } from './PaperView'

export default async function PaperPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const paper = await getOrCreateCurrentPaper(user.id)

  return <PaperView paperId={paper.id} initialHtml={paper.composed_html} />
}
```

**Step 3: Create ChatSidebar component**

Create `src/app/paper/ChatSidebar.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'

type ChatEntry = {
  type: 'user' | 'system'
  text: string
}

const PRESETS = [
  { label: 'Meal', hint: 'e.g., Tacos for Wednesday dinner' },
  { label: 'Event', hint: "e.g., Soccer practice Tuesday at 5" },
  { label: 'Chore', hint: 'e.g., Feed the dog — Miles' },
  { label: 'Custom', hint: 'Anything you want to add or change' },
]

export function ChatSidebar({
  paperId,
  onUpdate,
}: {
  paperId: string
  onUpdate: () => void
}) {
  const [input, setInput] = useState('')
  const [placeholder, setPlaceholder] = useState('Add something to this week\'s paper...')
  const [history, setHistory] = useState<ChatEntry[]>([])
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  function selectPreset(preset: typeof PRESETS[number]) {
    setPlaceholder(preset.hint)
    setInput('')
    inputRef.current?.focus()
  }

  async function send(text?: string) {
    const message = text || input.trim()
    if (!message || sending) return

    setHistory(prev => [...prev, { type: 'user', text: message }])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, paperId }),
      })

      const data = await res.json()
      setHistory(prev => [...prev, { type: 'system', text: data.confirmation }])

      if (data.hasUpdates) {
        onUpdate()
      }
    } catch {
      setHistory(prev => [...prev, { type: 'system', text: 'Something went wrong. Try again?' }])
    } finally {
      setSending(false)
      setPlaceholder('Add something to this week\'s paper...')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="font-serif text-sm font-semibold text-stone-700">
          Add something to this week&apos;s paper
        </h2>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {history.length === 0 && (
          <p className="text-sm text-stone-400 italic">
            Type below or pick a quick add to get started.
          </p>
        )}
        {history.map((entry, i) => (
          <div
            key={i}
            className={`text-sm ${
              entry.type === 'user'
                ? 'text-stone-700'
                : 'text-amber-700 font-medium'
            }`}
          >
            {entry.type === 'user' ? '> ' : ''}{entry.text}
          </div>
        ))}
        {sending && (
          <div className="text-sm text-stone-400 animate-pulse">
            Updating your paper...
          </div>
        )}
        <div ref={historyEndRef} />
      </div>

      {/* Quick picks */}
      <div className="border-t border-stone-100 px-4 py-2">
        <div className="flex gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => selectPreset(preset)}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-amber-100 hover:text-amber-700"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-stone-200 px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={sending}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 4: Create PaperView component**

Create `src/app/paper/PaperView.tsx`:

```typescript
'use client'

import { useState, useRef, useCallback } from 'react'
import { ChatSidebar } from './ChatSidebar'

export function PaperView({
  paperId,
  initialHtml,
}: {
  paperId: string
  initialHtml: string | null
}) {
  const [html, setHtml] = useState(initialHtml)
  const [composing, setComposing] = useState(false)
  const composeTimer = useRef<NodeJS.Timeout | null>(null)

  const triggerRecompose = useCallback(() => {
    // Debounce: wait 2 seconds after last update before recomposing
    if (composeTimer.current) clearTimeout(composeTimer.current)

    composeTimer.current = setTimeout(async () => {
      setComposing(true)
      try {
        const res = await fetch('/api/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId }),
        })
        const data = await res.json()
        if (data.html) setHtml(data.html)
      } finally {
        setComposing(false)
      }
    }, 2000)
  }, [paperId])

  return (
    <div className="flex h-full">
      {/* Newsletter preview */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto" style={{ maxWidth: '8.5in' }}>
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              {composing && (
                <span className="text-sm text-amber-600 animate-pulse">
                  Recomposing your paper...
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/pdf/${paperId}`}
                target="_blank"
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
              >
                Download PDF
              </a>
              <button
                onClick={() => {
                  const iframe = document.querySelector('iframe')
                  iframe?.contentWindow?.print()
                }}
                className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
              >
                Print
              </button>
            </div>
          </div>

          {/* Newsletter */}
          {html ? (
            <div className="bg-white shadow-lg">
              <iframe
                srcDoc={html}
                className="w-full border-0"
                style={{ height: '11in' }}
                title="Your Poopin' Papers"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center bg-white shadow-lg" style={{ height: '11in' }}>
              <div className="text-center">
                <div className="text-4xl mb-4">🧻</div>
                <p className="text-stone-500 text-lg font-serif">
                  Composing your first issue...
                </p>
                <p className="text-stone-400 text-sm mt-2">
                  This takes about 15 seconds
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat sidebar */}
      <div className="w-96 border-l border-stone-200 bg-white">
        <ChatSidebar paperId={paperId} onUpdate={triggerRecompose} />
      </div>
    </div>
  )
}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add single-screen paper view with newsletter preview and chat sidebar"
```

---

## Task 6: Update Middleware and Navigation

**Files:**
- Modify: `src/lib/supabase/middleware.ts`
- Modify: `src/app/dashboard/layout.tsx`

**Step 1: Update middleware to redirect to /paper**

In `src/lib/supabase/middleware.ts`, the authenticated redirect already updated in Task 1. Now also add `/onboarding` to redirect to `/paper` if user visits it:

After the existing authenticated user redirect block, add:

```typescript
if (user && request.nextUrl.pathname === '/onboarding') {
  const url = request.nextUrl.clone()
  url.pathname = '/paper'
  return NextResponse.redirect(url)
}
```

**Step 2: Add "Back to Paper" link in dashboard layout**

In `src/app/dashboard/layout.tsx`, add a link back to the paper view in the header nav:

Add before the Settings link:
```typescript
<Link href="/paper" className="text-sm text-stone-600 hover:text-stone-900">Back to Paper</Link>
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: update navigation to center on /paper view"
```

---

## Task 7: Polish and Build Check

**Files:**
- Various fixes as needed

**Step 1: Run the full test suite**

```bash
npm test
```

Fix any failures.

**Step 2: Run build**

```bash
npm run build
```

Fix any TypeScript or build errors.

**Step 3: Manual smoke test**

1. Start dev server: `npm run dev`
2. Go to http://localhost:3000/signup
3. Create account
4. Verify redirect to /paper
5. Verify newsletter is composing/composed
6. Type "Add tacos for Wednesday dinner" in chat
7. Verify confirmation appears and newsletter recomposes
8. Try preset buttons
9. Try "Download PDF" and "Print"

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish magic-first UX, fix build issues"
```

---

## Summary

| Task | What it builds | Depends on |
|------|---------------|------------|
| 1 | Skip onboarding, redirect to /paper, auto-detect timezone | -- |
| 2 | Auto-generate this_week + auto-compose on first paper | 1 |
| 3 | Chat API (Haiku parses messages → section updates) | -- |
| 4 | (Skipped — existing compose route works) | -- |
| 5 | Single-screen paper view + chat sidebar | 2, 3 |
| 6 | Navigation updates (middleware, dashboard links) | 1, 5 |
| 7 | Polish and build check | All |

**Parallelizable:** Tasks 1 and 3 can run in parallel. Task 2 depends on 1. Task 5 depends on 2 and 3. Tasks 6 and 7 are sequential at the end.
