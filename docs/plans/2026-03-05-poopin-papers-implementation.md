# Poopin' Papers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js web app where families create weekly printable PDF newsletters with AI-composed layouts.

**Architecture:** Three-layer system -- Platform (Next.js + Supabase), Content Engine (Claude Haiku for section content), Composition Engine (Claude Sonnet for HTML layout). The composition engine receives a design system document + weekly content and produces unique HTML each issue. Puppeteer renders to PDF. Resend delivers emails on a Saturday preview / Sunday final cycle.

**Tech Stack:** Next.js 14+ (App Router), Supabase (Auth + Postgres), Anthropic SDK (Haiku 4.5 + Sonnet 4.6), @sparticuz/chromium + puppeteer-core, Resend, Tailwind CSS, Vercel

**Design doc:** `docs/plans/2026-03-05-poopin-papers-design.md`
**Sample PDF:** `docs/sample-design/poopin-papers-2026-03-02 (1).pdf`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.js`, `tsconfig.json`, `postcss.config.js`
- Create: `.env.local.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Step 1: Scaffold Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Accept defaults. This creates the full Next.js 14+ App Router project structure.

**Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk resend puppeteer-core @sparticuz/chromium
```

**Step 3: Install dev dependencies**

```bash
npm install -D @types/node supabase vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 4: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 5: Create `.gitignore` additions**

Ensure `.env.local` and `node_modules` are in `.gitignore` (create-next-app handles this, but verify).

**Step 6: Set up Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest'
```

Add to `package.json` scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Step 7: Verify the app starts**

```bash
npm run dev
```

Expected: Next.js dev server starts on localhost:3000 with the default page.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with core dependencies"
```

---

## Task 2: Supabase Schema & Client Setup

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `src/lib/supabase/client.ts` (browser client)
- Create: `src/lib/supabase/server.ts` (server client)
- Create: `src/lib/supabase/middleware.ts` (auth middleware)
- Create: `src/middleware.ts`
- Create: `src/lib/types/database.ts`

**Step 1: Initialize Supabase locally**

```bash
npx supabase init
```

**Step 2: Create initial migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Users profile (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  family_name text,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Household members
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  age integer,
  role text not null default 'kid' check (role in ('parent', 'kid')),
  created_at timestamptz not null default now()
);

alter table public.household_members enable row level security;

create policy "Users can manage own household"
  on public.household_members for all using (auth.uid() = user_id);

-- Papers
create table public.papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'preview', 'final')),
  composed_html text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

alter table public.papers enable row level security;

create policy "Users can manage own papers"
  on public.papers for all using (auth.uid() = user_id);

-- Paper sections
create table public.paper_sections (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid references public.papers(id) on delete cascade not null,
  section_type text not null check (section_type in (
    'this_week', 'meal_plan', 'chores', 'coaching', 'fun_zone', 'brain_fuel'
  )),
  content jsonb not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(paper_id, section_type)
);

alter table public.paper_sections enable row level security;

create policy "Users can manage own paper sections"
  on public.paper_sections for all
  using (
    exists (
      select 1 from public.papers
      where papers.id = paper_sections.paper_id
      and papers.user_id = auth.uid()
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger papers_updated_at before update on public.papers
  for each row execute function public.update_updated_at();

create trigger paper_sections_updated_at before update on public.paper_sections
  for each row execute function public.update_updated_at();
```

**Step 3: Create TypeScript types**

Create `src/lib/types/database.ts`:

```typescript
export type Profile = {
  id: string
  email: string
  family_name: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export type HouseholdMember = {
  id: string
  user_id: string
  name: string
  age: number | null
  role: 'parent' | 'kid'
  created_at: string
}

export type PaperStatus = 'draft' | 'preview' | 'final'

export type Paper = {
  id: string
  user_id: string
  week_start: string
  status: PaperStatus
  composed_html: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export type SectionType =
  | 'this_week'
  | 'meal_plan'
  | 'chores'
  | 'coaching'
  | 'fun_zone'
  | 'brain_fuel'

export type PaperSection = {
  id: string
  paper_id: string
  section_type: SectionType
  content: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

// Content shapes
export type MealPlanContent = {
  meals: Record<string, { breakfast?: string; lunch?: string; dinner?: string }>
}

export type ChoresContent = {
  items: Array<{ text: string; assignee: string | null }>
}

export type ThisWeekContent = {
  items: Array<{ text: string; icon?: string }>
}

export type GeneratedContent = {
  generated: boolean
  content: {
    title: string
    body: string
  }
}
```

**Step 4: Create Supabase browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 5: Create Supabase server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  )
}
```

**Step 6: Create auth middleware**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except public routes)
  const publicRoutes = ['/', '/login', '/signup']
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname)

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase schema, types, and client setup"
```

---

## Task 3: Auth Pages (Signup + Login)

**Files:**
- Create: `src/app/signup/page.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/onboarding/page.tsx`

**Step 1: Create signup page**

Create `src/app/signup/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/onboarding')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-stone-800">
            Poopin' Papers
          </h1>
          <p className="text-stone-500 mt-2 italic">
            The Only Newspaper Worth Sitting Down For
          </p>
        </div>
        <form onSubmit={handleSignup} className="bg-white p-8 rounded-lg shadow-sm border border-stone-200 space-y-4">
          <h2 className="text-xl font-serif font-semibold text-stone-800">Create your account</h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-800 text-white py-2 px-4 rounded font-medium hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
          <p className="text-center text-sm text-stone-500">
            Already have an account? <Link href="/login" className="text-amber-700 hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Create login page**

Create `src/app/login/page.tsx` — same structure as signup but calls `supabase.auth.signInWithPassword` and redirects to `/dashboard`.

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-stone-800">
            Poopin' Papers
          </h1>
          <p className="text-stone-500 mt-2 italic">
            The Only Newspaper Worth Sitting Down For
          </p>
        </div>
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-sm border border-stone-200 space-y-4">
          <h2 className="text-xl font-serif font-semibold text-stone-800">Welcome back</h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-800 text-white py-2 px-4 rounded font-medium hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
          <p className="text-center text-sm text-stone-500">
            Don't have an account? <Link href="/signup" className="text-amber-700 hover:underline">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

**Step 3: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

**Step 4: Create onboarding page**

Create `src/app/onboarding/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Pacific/Honolulu',
]

export default function OnboardingPage() {
  const [familyName, setFamilyName] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [members, setMembers] = useState<Array<{ name: string; age: string; role: string }>>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function addMember() {
    setMembers([...members, { name: '', age: '', role: 'kid' }])
  }

  function updateMember(index: number, field: string, value: string) {
    const updated = [...members]
    updated[index] = { ...updated[index], [field]: value }
    setMembers(updated)
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Update profile
    await supabase
      .from('profiles')
      .update({ family_name: familyName, timezone })
      .eq('id', user.id)

    // Add household members
    if (members.length > 0) {
      const memberRows = members
        .filter(m => m.name.trim())
        .map(m => ({
          user_id: user.id,
          name: m.name.trim(),
          age: m.age ? parseInt(m.age) : null,
          role: m.role,
        }))

      if (memberRows.length > 0) {
        await supabase.from('household_members').insert(memberRows)
      }
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="max-w-lg w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-stone-800">Set Up Your Household</h1>
          <p className="text-stone-500 mt-2">Tell us a bit about your family</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-stone-200 space-y-6">
          <div>
            <label htmlFor="familyName" className="block text-sm font-medium text-stone-700">Family Name</label>
            <input
              id="familyName"
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="The Johnsons"
              required
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-stone-700">Timezone</label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz.replace('_', ' ').replace('America/', '').replace('Pacific/', '')}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">Family Members (optional)</label>
              <button type="button" onClick={addMember} className="text-sm text-amber-700 hover:underline">
                + Add member
              </button>
            </div>
            {members.map((member, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={member.name}
                  onChange={(e) => updateMember(i, 'name', e.target.value)}
                  className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
                <input
                  type="number"
                  placeholder="Age"
                  value={member.age}
                  onChange={(e) => updateMember(i, 'age', e.target.value)}
                  className="w-16 rounded border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
                <select
                  value={member.role}
                  onChange={(e) => updateMember(i, 'role', e.target.value)}
                  className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900"
                >
                  <option value="kid">Kid</option>
                  <option value="parent">Parent</option>
                </select>
                <button type="button" onClick={() => removeMember(i)} className="text-stone-400 hover:text-red-500 px-1">x</button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-800 text-white py-2 px-4 rounded font-medium hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Continue to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 5: Verify auth flow works**

```bash
npm run dev
```

Navigate to `/signup`, create an account, verify redirect to `/onboarding`, fill in family info, verify redirect to `/dashboard` (will be 404 — that's expected at this point).

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add auth pages (signup, login, onboarding) with Supabase Auth"
```

---

## Task 4: Paper Data Layer (CRUD helpers)

**Files:**
- Create: `src/lib/papers.ts`
- Create: `src/lib/sections.ts`
- Test: `src/lib/__tests__/papers.test.ts`

**Step 1: Write tests for paper helpers**

Create `src/lib/__tests__/papers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getCurrentWeekStart, getDefaultSections } from '../papers'

describe('getCurrentWeekStart', () => {
  it('returns the most recent Sunday', () => {
    // Wednesday March 5, 2026
    const date = new Date('2026-03-05T12:00:00')
    const weekStart = getCurrentWeekStart(date)
    expect(weekStart).toBe('2026-03-01') // Sunday March 1
  })

  it('returns the same day if already Sunday', () => {
    const date = new Date('2026-03-01T12:00:00')
    const weekStart = getCurrentWeekStart(date)
    expect(weekStart).toBe('2026-03-01')
  })
})

describe('getDefaultSections', () => {
  it('returns all 6 section types', () => {
    const sections = getDefaultSections()
    const types = sections.map(s => s.section_type)
    expect(types).toEqual([
      'this_week', 'meal_plan', 'chores', 'coaching', 'fun_zone', 'brain_fuel'
    ])
  })

  it('all sections are enabled by default', () => {
    const sections = getDefaultSections()
    expect(sections.every(s => s.enabled)).toBe(true)
  })

  it('chores section has default items', () => {
    const sections = getDefaultSections()
    const chores = sections.find(s => s.section_type === 'chores')
    expect((chores?.content as { items: unknown[] }).items.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — modules don't exist yet.

**Step 3: Implement paper helpers**

Create `src/lib/papers.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Paper, SectionType } from '@/lib/types/database'

export function getCurrentWeekStart(now: Date = new Date()): string {
  const date = new Date(now)
  const day = date.getDay() // 0 = Sunday
  date.setDate(date.getDate() - day)
  return date.toISOString().split('T')[0]
}

export function getDefaultSections(): Array<{
  section_type: SectionType
  content: Record<string, unknown>
  enabled: boolean
}> {
  return [
    {
      section_type: 'this_week',
      content: { items: [] },
      enabled: true,
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
    },
    {
      section_type: 'coaching',
      content: { generated: false, content: { title: '', body: '' } },
      enabled: true,
    },
    {
      section_type: 'fun_zone',
      content: { generated: false, content: { title: '', body: '' } },
      enabled: true,
    },
    {
      section_type: 'brain_fuel',
      content: { generated: false, content: { title: '', body: '' } },
      enabled: true,
    },
  ]
}

export async function getOrCreateCurrentPaper(userId: string): Promise<Paper> {
  const supabase = await createClient()
  const weekStart = getCurrentWeekStart()

  // Try to find existing paper for this week
  const { data: existing } = await supabase
    .from('papers')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single()

  if (existing) return existing as Paper

  // Create new paper with default sections
  const { data: paper, error } = await supabase
    .from('papers')
    .insert({ user_id: userId, week_start: weekStart })
    .select()
    .single()

  if (error) throw error

  // Insert default sections
  const sections = getDefaultSections().map(s => ({
    ...s,
    paper_id: paper.id,
  }))

  await supabase.from('paper_sections').insert(sections)

  return paper as Paper
}

export async function getPaperWithSections(paperId: string) {
  const supabase = await createClient()

  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .single()

  const { data: sections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)
    .order('section_type')

  return { paper, sections: sections ?? [] }
}
```

**Step 4: Implement section update helper**

Create `src/lib/sections.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'

export async function updateSectionContent(
  sectionId: string,
  content: Record<string, unknown>
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('paper_sections')
    .update({ content })
    .eq('id', sectionId)

  if (error) throw error
}

export async function toggleSection(sectionId: string, enabled: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('paper_sections')
    .update({ enabled })
    .eq('id', sectionId)

  if (error) throw error
}
```

**Step 5: Run tests**

```bash
npm test
```

Expected: PASS for pure function tests. (The async Supabase functions aren't unit tested — they'll be tested via integration.)

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add paper and section data layer with CRUD helpers"
```

---

## Task 5: Dashboard & Section Editors

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/components/section-editors/MealPlanEditor.tsx`
- Create: `src/components/section-editors/ChoresEditor.tsx`
- Create: `src/components/section-editors/ThisWeekEditor.tsx`
- Create: `src/components/section-editors/GeneratedContentEditor.tsx`
- Create: `src/components/section-editors/SectionToggle.tsx`
- Create: `src/app/api/papers/sections/[id]/route.ts`

**Step 1: Create API route for section updates**

Create `src/app/api/papers/sections/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Verify ownership through paper
  const { data: section } = await supabase
    .from('paper_sections')
    .select('*, papers!inner(user_id)')
    .eq('id', id)
    .single()

  if (!section || (section as any).papers.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (body.content !== undefined) updates.content = body.content
  if (body.enabled !== undefined) updates.enabled = body.enabled

  const { error } = await supabase
    .from('paper_sections')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Create dashboard layout**

Create `src/app/dashboard/layout.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-800">Poopin' Papers</h1>
            {profile?.family_name && (
              <p className="text-sm text-stone-500">The {profile.family_name} Edition</p>
            )}
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/dashboard/settings" className="text-sm text-stone-600 hover:text-stone-900">Settings</Link>
            <form action="/api/auth/signout" method="post">
              <button className="text-sm text-stone-600 hover:text-stone-900">Sign Out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

**Step 3: Create section editor components**

Create `src/components/section-editors/MealPlanEditor.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { MealPlanContent, PaperSection } from '@/lib/types/database'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MEALS = ['breakfast', 'lunch', 'dinner'] as const

export function MealPlanEditor({ section }: { section: PaperSection }) {
  const [content, setContent] = useState<MealPlanContent>(section.content as MealPlanContent)
  const [saving, setSaving] = useState(false)

  function updateMeal(day: string, meal: string, value: string) {
    setContent(prev => ({
      meals: {
        ...prev.meals,
        [day]: { ...prev.meals[day], [meal]: value },
      },
    }))
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/papers/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setSaving(false)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-2 text-stone-500 font-medium w-20"></th>
              {DAY_LABELS.map(d => (
                <th key={d} className="text-center py-2 px-1 text-stone-500 font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEALS.map(meal => (
              <tr key={meal}>
                <td className="py-1 pr-2 text-stone-600 font-medium capitalize">{meal}</td>
                {DAYS.map(day => (
                  <td key={day} className="py-1 px-1">
                    <input
                      type="text"
                      value={content.meals?.[day]?.[meal] ?? ''}
                      onChange={e => updateMeal(day, meal, e.target.value)}
                      onBlur={save}
                      className="w-full rounded border border-stone-200 px-2 py-1 text-sm text-stone-900 focus:border-amber-500 focus:ring-amber-500"
                      placeholder="-"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {saving && <p className="text-xs text-stone-400 mt-1">Saving...</p>}
    </div>
  )
}
```

Create `src/components/section-editors/ChoresEditor.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { ChoresContent, PaperSection } from '@/lib/types/database'

export function ChoresEditor({ section }: { section: PaperSection }) {
  const [content, setContent] = useState<ChoresContent>(section.content as ChoresContent)
  const [saving, setSaving] = useState(false)

  async function save(updated: ChoresContent) {
    setSaving(true)
    await fetch(`/api/papers/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updated }),
    })
    setSaving(false)
  }

  function updateItem(index: number, text: string) {
    const updated = {
      items: content.items.map((item, i) =>
        i === index ? { ...item, text } : item
      ),
    }
    setContent(updated)
  }

  function updateAssignee(index: number, assignee: string) {
    const updated = {
      items: content.items.map((item, i) =>
        i === index ? { ...item, assignee: assignee || null } : item
      ),
    }
    setContent(updated)
    save(updated)
  }

  function addItem() {
    const updated = {
      items: [...content.items, { text: '', assignee: null }],
    }
    setContent(updated)
  }

  function removeItem(index: number) {
    const updated = {
      items: content.items.filter((_, i) => i !== index),
    }
    setContent(updated)
    save(updated)
  }

  return (
    <div className="space-y-2">
      {content.items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            value={item.text}
            onChange={e => updateItem(i, e.target.value)}
            onBlur={() => save(content)}
            placeholder="Chore description"
            className="flex-1 rounded border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:ring-amber-500"
          />
          <input
            type="text"
            value={item.assignee ?? ''}
            onChange={e => updateAssignee(i, e.target.value)}
            placeholder="Who?"
            className="w-24 rounded border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:ring-amber-500"
          />
          <button
            onClick={() => removeItem(i)}
            className="text-stone-400 hover:text-red-500 px-1"
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-sm text-amber-700 hover:underline"
      >
        + Add chore
      </button>
      {saving && <p className="text-xs text-stone-400">Saving...</p>}
    </div>
  )
}
```

Create `src/components/section-editors/ThisWeekEditor.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { ThisWeekContent, PaperSection } from '@/lib/types/database'

export function ThisWeekEditor({ section }: { section: PaperSection }) {
  const [content, setContent] = useState<ThisWeekContent>(section.content as ThisWeekContent)
  const [saving, setSaving] = useState(false)

  async function save(updated: ThisWeekContent) {
    setSaving(true)
    await fetch(`/api/papers/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updated }),
    })
    setSaving(false)
  }

  function updateItem(index: number, text: string) {
    const updated = {
      items: content.items.map((item, i) =>
        i === index ? { ...item, text } : item
      ),
    }
    setContent(updated)
  }

  function addItem() {
    const updated = {
      items: [...content.items, { text: '' }],
    }
    setContent(updated)
  }

  function removeItem(index: number) {
    const updated = {
      items: content.items.filter((_, i) => i !== index),
    }
    setContent(updated)
    save(updated)
  }

  return (
    <div className="space-y-2">
      {content.items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            value={item.text}
            onChange={e => updateItem(i, e.target.value)}
            onBlur={() => save(content)}
            placeholder="What's happening this week?"
            className="flex-1 rounded border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:ring-amber-500"
          />
          <button
            onClick={() => removeItem(i)}
            className="text-stone-400 hover:text-red-500 px-1"
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-sm text-amber-700 hover:underline"
      >
        + Add item
      </button>
      {saving && <p className="text-xs text-stone-400">Saving...</p>}
    </div>
  )
}
```

Create `src/components/section-editors/GeneratedContentEditor.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { GeneratedContent, PaperSection, SectionType } from '@/lib/types/database'

const SECTION_LABELS: Record<string, string> = {
  coaching: 'Coaching Corner',
  fun_zone: 'The Fun Zone',
  brain_fuel: 'Brain Fuel',
}

export function GeneratedContentEditor({
  section,
  householdAges,
}: {
  section: PaperSection
  householdAges?: number[]
}) {
  const [content, setContent] = useState<GeneratedContent>(section.content as GeneratedContent)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function save(updated: GeneratedContent) {
    setSaving(true)
    await fetch(`/api/papers/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: updated }),
    })
    setSaving(false)
  }

  async function regenerate() {
    setGenerating(true)
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionType: section.section_type,
        ages: householdAges,
      }),
    })
    const data = await res.json()
    const updated: GeneratedContent = {
      generated: true,
      content: data.content,
    }
    setContent(updated)
    await save(updated)
    setGenerating(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <input
          type="text"
          value={content.content?.title ?? ''}
          onChange={e => {
            const updated = {
              ...content,
              content: { ...content.content, title: e.target.value },
            }
            setContent(updated)
          }}
          onBlur={() => save(content)}
          placeholder="Title"
          className="w-full rounded border border-stone-200 px-3 py-2 text-sm font-medium text-stone-900 focus:border-amber-500 focus:ring-amber-500"
        />
      </div>
      <div>
        <textarea
          value={content.content?.body ?? ''}
          onChange={e => {
            const updated = {
              ...content,
              content: { ...content.content, body: e.target.value },
            }
            setContent(updated)
          }}
          onBlur={() => save(content)}
          placeholder="Content..."
          rows={4}
          className="w-full rounded border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:ring-amber-500"
        />
      </div>
      <button
        onClick={regenerate}
        disabled={generating}
        className="text-sm bg-amber-100 text-amber-800 px-3 py-1 rounded hover:bg-amber-200 disabled:opacity-50"
      >
        {generating ? 'Generating...' : 'Regenerate with AI'}
      </button>
      {saving && <span className="text-xs text-stone-400 ml-2">Saving...</span>}
    </div>
  )
}
```

**Step 4: Create dashboard page**

Create `src/app/dashboard/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateCurrentPaper, getPaperWithSections } from '@/lib/papers'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const paper = await getOrCreateCurrentPaper(user.id)
  const { sections } = await getPaperWithSections(paper.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name, timezone')
    .eq('id', user.id)
    .single()

  const { data: members } = await supabase
    .from('household_members')
    .select('name, age')
    .eq('user_id', user.id)

  return (
    <DashboardClient
      paper={paper}
      sections={sections}
      familyName={profile?.family_name ?? 'Your Family'}
      householdAges={(members ?? []).map(m => m.age).filter((a): a is number => a !== null)}
    />
  )
}
```

Create `src/app/dashboard/DashboardClient.tsx`:

```typescript
'use client'

import type { Paper, PaperSection } from '@/lib/types/database'
import { MealPlanEditor } from '@/components/section-editors/MealPlanEditor'
import { ChoresEditor } from '@/components/section-editors/ChoresEditor'
import { ThisWeekEditor } from '@/components/section-editors/ThisWeekEditor'
import { GeneratedContentEditor } from '@/components/section-editors/GeneratedContentEditor'
import Link from 'next/link'

const SECTION_CONFIG: Record<string, { label: string; emoji: string }> = {
  this_week: { label: 'This Week', emoji: '📋' },
  meal_plan: { label: "This Week's Menu", emoji: '🍽️' },
  chores: { label: 'Weekly Chore Check', emoji: '🧹' },
  coaching: { label: 'Coaching Corner', emoji: '🧠' },
  fun_zone: { label: 'The Fun Zone', emoji: '😄' },
  brain_fuel: { label: 'Brain Fuel', emoji: '💡' },
}

export function DashboardClient({
  paper,
  sections,
  familyName,
  householdAges,
}: {
  paper: Paper
  sections: PaperSection[]
  familyName: string
  householdAges: number[]
}) {
  function renderEditor(section: PaperSection) {
    switch (section.section_type) {
      case 'this_week':
        return <ThisWeekEditor section={section} />
      case 'meal_plan':
        return <MealPlanEditor section={section} />
      case 'chores':
        return <ChoresEditor section={section} />
      case 'coaching':
      case 'fun_zone':
      case 'brain_fuel':
        return <GeneratedContentEditor section={section} householdAges={householdAges} />
      default:
        return null
    }
  }

  const sortedSections = [...sections].sort((a, b) => {
    const order = ['this_week', 'meal_plan', 'chores', 'coaching', 'fun_zone', 'brain_fuel']
    return order.indexOf(a.section_type) - order.indexOf(b.section_type)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-800">
            Week of {new Date(paper.week_start + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </h2>
          <p className="text-stone-500 text-sm">The {familyName} Edition</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/preview/${paper.id}`}
            className="bg-stone-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-stone-700"
          >
            Preview & Print
          </Link>
        </div>
      </div>

      {sortedSections.map(section => {
        const config = SECTION_CONFIG[section.section_type]
        return (
          <div
            key={section.id}
            className="bg-white rounded-lg border border-stone-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-stone-50">
              <h3 className="font-serif font-semibold text-stone-800">
                {config?.emoji} {config?.label ?? section.section_type}
              </h3>
              <label className="flex items-center gap-2 text-sm text-stone-500">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={async (e) => {
                    await fetch(`/api/papers/sections/${section.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: e.target.checked }),
                    })
                  }}
                  className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                Include
              </label>
            </div>
            <div className="p-5">
              {renderEditor(section)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 5: Create sign-out API route**

Create `src/app/api/auth/signout/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}
```

**Step 6: Verify the dashboard renders**

```bash
npm run dev
```

Log in, verify dashboard shows all 6 sections with editors. Test editing a meal plan cell, adding a chore, adding a This Week item.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add dashboard with section editors (meal plan, chores, this week, AI content)"
```

---

## Task 6: AI Content Generation (Claude Haiku)

**Files:**
- Create: `src/lib/ai/content.ts`
- Create: `src/app/api/generate/route.ts`
- Test: `src/lib/ai/__tests__/content.test.ts`

**Step 1: Write test for prompt construction**

Create `src/lib/ai/__tests__/content.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildContentPrompt } from '../content'

describe('buildContentPrompt', () => {
  it('builds coaching prompt with ages', () => {
    const prompt = buildContentPrompt('coaching', [8, 12])
    expect(prompt).toContain('coaching')
    expect(prompt).toContain('8')
    expect(prompt).toContain('12')
  })

  it('builds fun_zone prompt without ages', () => {
    const prompt = buildContentPrompt('fun_zone', [])
    expect(prompt).toContain('joke')
  })

  it('builds brain_fuel prompt', () => {
    const prompt = buildContentPrompt('brain_fuel', [10])
    expect(prompt).toContain('quote')
    expect(prompt).toContain('brain teaser')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

**Step 3: Implement content generation**

Create `src/lib/ai/content.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export function buildContentPrompt(sectionType: string, ages: number[]): string {
  const ageContext = ages.length > 0
    ? `The family has kids aged ${ages.join(', ')}.`
    : 'The family has children.'

  switch (sectionType) {
    case 'coaching':
      return `Write a short coaching/motivational lesson for a family bathroom newsletter. ${ageContext} The lesson should be age-appropriate, warm, and actionable. Include a catchy title and a 3-4 sentence body. The tone should be encouraging and conversational — like a cool parent or mentor talking to kids. Return JSON: {"title": "...", "body": "..."}`

    case 'fun_zone':
      return `Write content for the "Fun Zone" section of a family bathroom newsletter. ${ageContext} Include: 2 kid-friendly jokes (Q&A format) and 1 fun "Did You Know?" fact. Keep it age-appropriate, playful, and genuinely funny — not corny. Return JSON: {"title": "The Fun Zone", "body": "..."} where body contains the jokes and fact formatted with line breaks.`

    case 'brain_fuel':
      return `Write content for the "Brain Fuel" section of a family bathroom newsletter. ${ageContext} Include: 1 inspirational quote (with attribution) and 1 brain teaser with the answer in parentheses. Keep it age-appropriate and engaging. Return JSON: {"title": "Brain Fuel", "body": "..."} where body contains the quote and brain teaser.`

    default:
      return `Write a short, engaging piece of content for a family newsletter section called "${sectionType}". Return JSON: {"title": "...", "body": "..."}`
  }
}

export async function generateContent(
  sectionType: string,
  ages: number[] = []
): Promise<{ title: string; body: string }> {
  const prompt = buildContentPrompt(sectionType, ages)

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response')
  }

  return JSON.parse(jsonMatch[0])
}
```

**Step 4: Create API route**

Create `src/app/api/generate/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { generateContent } from '@/lib/ai/content'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sectionType, ages } = await request.json()

  const content = await generateContent(sectionType, ages ?? [])

  return NextResponse.json({ content })
}
```

**Step 5: Run tests**

```bash
npm test
```

Expected: PASS for prompt construction tests.

**Step 6: Verify AI generation works**

From the dashboard, click "Regenerate with AI" on the Coaching Corner section. Verify content appears.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add AI content generation with Claude Haiku for coaching, jokes, brain teasers"
```

---

## Task 7: Design System Document

**Files:**
- Create: `src/lib/ai/design-system.ts`

This is the document that Claude Sonnet uses as its "art direction" guide when composing each issue.

**Step 1: Create the design system document**

Create `src/lib/ai/design-system.ts`:

```typescript
export const DESIGN_SYSTEM = `
# Poopin' Papers Design System

You are an art director composing a one-page printable family newsletter called "Poopin' Papers." Each issue should feel handcrafted, warm, and newspaper-inspired — never corporate or sterile.

## Core Visual Identity
- **Font:** Georgia serif for all text. Use font-weight and size for hierarchy.
- **Color palette:** Warm neutrals — stone/brown tones for text (#292524, #44403c, #78716c), cream/amber backgrounds (#fffbeb, #fef3c7), subtle borders in warm gray. Minimal color — the warmth comes from the paper-like aesthetic.
- **Borders:** Double-rule lines for major dividers (like a real newspaper). Single thin borders for section boxes.
- **Page size:** US Letter (8.5" x 11"), single page only. Use @page CSS rules.
- **Margins:** 0.5" on all sides.
- **Overall feel:** Like a small-town community newspaper — charming, a little playful, clearly made with love.

## Layout Rules
- Compose the page to use available space well. Don't leave large gaps.
- Sections can be full-width, half-width (2 columns), or mixed. Vary the layout based on content — don't always use the same grid.
- The masthead (family name, tagline, date) always goes at the top.
- Use CSS Grid or Flexbox for layout. The page must render correctly in Chromium.
- Emoji are welcome as section header accents.
- Checkbox squares (☐) for chore items.

## Section Handling
- Only include sections that have content (will be specified in the data).
- If a section has lots of content, give it more space. If sparse, keep it compact.
- The meal plan works well as a table/grid.
- Chores work well as a checklist.
- Coaching Corner can be full-width with a pull-quote style title.
- Fun Zone and Brain Fuel work well side by side at the bottom.

## Typography
- Masthead: 28-36pt, bold
- Section headers: 14-16pt, bold, uppercase or small-caps
- Body text: 10-12pt
- Fine print/footer: 8pt

## Footer
- A warm sign-off line like: "Lovingly assembled for the [Family Name] household — Printed fresh every week — Please recycle (or compost)"
- Include the week date and issue number if provided.

## Critical Constraints
- MUST be exactly one page when printed on US Letter paper. Do not overflow.
- All CSS must be inline or in a <style> tag (no external stylesheets).
- Use print-optimized CSS: @page rules, color-adjust: exact, -webkit-print-color-adjust: exact.
- Must render in headless Chromium (Puppeteer). No JavaScript required.
- Return ONLY the complete HTML document (<!DOCTYPE html> to </html>). No explanation or markdown.
`
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add design system document for AI composition engine"
```

---

## Task 8: Composition Engine (Claude Sonnet)

**Files:**
- Create: `src/lib/ai/compose.ts`
- Create: `src/app/api/compose/route.ts`

**Step 1: Implement composition engine**

Create `src/lib/ai/compose.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { DESIGN_SYSTEM } from './design-system'
import type { PaperSection, Profile } from '@/lib/types/database'

const anthropic = new Anthropic()

function buildCompositionPrompt(
  profile: Pick<Profile, 'family_name'>,
  sections: PaperSection[],
  weekStart: string,
  issueNumber?: number
): string {
  const enabledSections = sections.filter(s => s.enabled)

  const sectionData = enabledSections.map(s => {
    return `### ${s.section_type}\n${JSON.stringify(s.content, null, 2)}`
  }).join('\n\n')

  return `Compose a single-page printable HTML newsletter with the following data:

**Family Name:** ${profile.family_name || 'Our Family'}
**Week of:** ${weekStart}
${issueNumber ? `**Issue #:** ${issueNumber}` : ''}

## Sections to include:
${sectionData}

${enabledSections.length < 6 ? `\nNote: Only ${enabledSections.length} sections have content this week. Use the space well — expand sections or use creative whitespace. Do NOT show empty sections.` : ''}

Follow the design system exactly. Return ONLY the complete HTML document.`
}

export async function composeNewsletter(
  profile: Pick<Profile, 'family_name'>,
  sections: PaperSection[],
  weekStart: string,
  issueNumber?: number
): Promise<string> {
  const prompt = buildCompositionPrompt(profile, sections, weekStart, issueNumber)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 8192,
    system: DESIGN_SYSTEM,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const html = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip any markdown code fences if present
  return html.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim()
}
```

**Step 2: Create API route**

Create `src/app/api/compose/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { composeNewsletter } from '@/lib/ai/compose'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { paperId } = await request.json()

  // Fetch paper, sections, and profile
  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  const { data: sections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name')
    .eq('id', user.id)
    .single()

  const html = await composeNewsletter(
    { family_name: profile?.family_name ?? null },
    sections ?? [],
    paper.week_start
  )

  // Save composed HTML to paper
  await supabase
    .from('papers')
    .update({ composed_html: html, status: 'preview' })
    .eq('id', paperId)

  return NextResponse.json({ html })
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add composition engine using Claude Sonnet for AI-composed newsletter HTML"
```

---

## Task 9: PDF Generation

**Files:**
- Create: `src/lib/pdf.ts`
- Create: `src/app/api/pdf/[paperId]/route.ts`

**Step 1: Implement PDF generation**

Create `src/lib/pdf.ts`:

```typescript
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  })

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })

  const pdf = await page.pdf({
    format: 'letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })

  await browser.close()

  return Buffer.from(pdf)
}
```

**Step 2: Create PDF API route**

Create `src/app/api/pdf/[paperId]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { generatePDF } from '@/lib/pdf'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: paper } = await supabase
    .from('papers')
    .select('composed_html, week_start')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper || !paper.composed_html) {
    return NextResponse.json({ error: 'Paper not composed yet' }, { status: 404 })
  }

  const pdf = await generatePDF(paper.composed_html)

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="poopin-papers-${paper.week_start}.pdf"`,
    },
  })
}

// Increase timeout for PDF generation
export const maxDuration = 30
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add PDF generation with Puppeteer and @sparticuz/chromium"
```

---

## Task 10: Web Preview Page

**Files:**
- Create: `src/app/preview/[id]/page.tsx`

**Step 1: Create preview page**

Create `src/app/preview/[id]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!paper) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="bg-white border-b border-stone-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
              &larr; Back to Editor
            </Link>
            <h1 className="text-lg font-serif font-bold text-stone-800">Preview</h1>
          </div>
          <div className="flex gap-3">
            <a
              href={`/api/pdf/${paper.id}`}
              target="_blank"
              className="bg-stone-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-stone-700"
            >
              Download PDF
            </a>
            <button
              onClick={() => window.print()}
              className="bg-amber-100 text-amber-800 px-4 py-2 rounded text-sm font-medium hover:bg-amber-200"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[8.5in] mx-auto my-8 bg-white shadow-lg">
        {paper.composed_html ? (
          <iframe
            srcDoc={paper.composed_html}
            className="w-full h-[11in] border-0"
            title="Newsletter Preview"
          />
        ) : (
          <PreviewComposer paperId={paper.id} />
        )}
      </div>
    </div>
  )
}

function PreviewComposer({ paperId }: { paperId: string }) {
  return (
    <div className="flex items-center justify-center h-[11in]">
      <ComposeButton paperId={paperId} />
    </div>
  )
}

// Client component for the compose button
import { ComposeButton } from './ComposeButton'
```

Create `src/app/preview/[id]/ComposeButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ComposeButton({ paperId }: { paperId: string }) {
  const [composing, setComposing] = useState(false)
  const router = useRouter()

  async function handleCompose() {
    setComposing(true)
    await fetch('/api/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId }),
    })
    router.refresh()
  }

  return (
    <div className="text-center">
      <p className="text-stone-500 mb-4">Your paper hasn't been composed yet.</p>
      <button
        onClick={handleCompose}
        disabled={composing}
        className="bg-stone-800 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-stone-700 disabled:opacity-50"
      >
        {composing ? 'Composing your paper...' : 'Compose My Paper'}
      </button>
      {composing && (
        <p className="text-sm text-stone-400 mt-3">
          Our AI art director is crafting this week's edition...
        </p>
      )}
    </div>
  )
}
```

Note: The preview page imports `ComposeButton` as a client component. The print button needs to be a client component too — refactor the toolbar into a client component:

Create `src/app/preview/[id]/PreviewToolbar.tsx`:

```typescript
'use client'

import Link from 'next/link'

export function PreviewToolbar({ paperId }: { paperId: string }) {
  return (
    <div className="bg-white border-b border-stone-200 px-6 py-3 print:hidden">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
            &larr; Back to Editor
          </Link>
          <h1 className="text-lg font-serif font-bold text-stone-800">Preview</h1>
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/pdf/${paperId}`}
            target="_blank"
            className="bg-stone-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-stone-700"
          >
            Download PDF
          </a>
          <button
            onClick={() => window.print()}
            className="bg-amber-100 text-amber-800 px-4 py-2 rounded text-sm font-medium hover:bg-amber-200"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
```

Update the preview page to use `PreviewToolbar` instead of inline toolbar.

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add web preview page with compose button, PDF download, and print"
```

---

## Task 11: Email Delivery (Resend)

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/app/api/cron/saturday-preview/route.ts`
- Create: `src/app/api/cron/sunday-deliver/route.ts`
- Modify: `next.config.js` (add cron config)
- Create: `vercel.json` (cron schedule)

**Step 1: Implement email sender**

Create `src/lib/email.ts`:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPreviewEmail(
  to: string,
  familyName: string,
  previewUrl: string
) {
  await resend.emails.send({
    from: 'Poopin\' Papers <papers@poopinpapers.com>',
    to,
    subject: `Your Poopin' Papers are ready for review!`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="font-size: 24px; color: #292524;">The ${familyName} Edition</h1>
        <p style="color: #44403c; font-size: 16px;">
          This week's Poopin' Papers are ready for your review. Take a look, make any tweaks, and we'll deliver the final version tomorrow morning.
        </p>
        <a href="${previewUrl}" style="display: inline-block; background: #292524; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; margin-top: 16px;">
          Preview & Edit &rarr;
        </a>
        <p style="color: #78716c; font-size: 12px; margin-top: 24px; font-style: italic;">
          The Only Newspaper Worth Sitting Down For
        </p>
      </div>
    `,
  })
}

export async function sendFinalEmail(
  to: string,
  familyName: string,
  pdfBuffer: Buffer,
  weekStart: string
) {
  await resend.emails.send({
    from: 'Poopin\' Papers <papers@poopinpapers.com>',
    to,
    subject: `This week's Poopin' Papers are here! 🧻`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="font-size: 24px; color: #292524;">The ${familyName} Edition</h1>
        <p style="color: #44403c; font-size: 16px;">
          This week's paper is attached and ready to print. Hang it up and enjoy!
        </p>
        <p style="color: #78716c; font-size: 12px; margin-top: 24px; font-style: italic;">
          The Only Newspaper Worth Sitting Down For
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `poopin-papers-${weekStart}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}
```

**Step 2: Create Saturday preview cron**

Create `src/app/api/cron/saturday-preview/route.ts`:

```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { composeNewsletter } from '@/lib/ai/compose'
import { generateContent } from '@/lib/ai/content'
import { sendPreviewEmail } from '@/lib/email'
import { getCurrentWeekStart, getDefaultSections } from '@/lib/papers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const weekStart = getCurrentWeekStart()

  // Find users whose timezone is currently 8 AM on Saturday
  const now = new Date()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, family_name, timezone')

  if (!profiles) return NextResponse.json({ processed: 0 })

  let processed = 0

  for (const profile of profiles) {
    // Check if it's Saturday 8 AM in user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: profile.timezone }))
    if (userTime.getDay() !== 6 || userTime.getHours() !== 8) continue

    // Get or create paper for this week
    let { data: paper } = await supabase
      .from('papers')
      .select('*')
      .eq('user_id', profile.id)
      .eq('week_start', weekStart)
      .single()

    if (!paper) {
      // Create paper with default sections
      const { data: newPaper } = await supabase
        .from('papers')
        .insert({ user_id: profile.id, week_start: weekStart })
        .select()
        .single()

      if (!newPaper) continue
      paper = newPaper

      const defaults = getDefaultSections().map(s => ({
        ...s,
        paper_id: paper!.id,
      }))
      await supabase.from('paper_sections').insert(defaults)
    }

    // Get sections
    const { data: sections } = await supabase
      .from('paper_sections')
      .select('*')
      .eq('paper_id', paper.id)

    if (!sections) continue

    // Get household member ages
    const { data: members } = await supabase
      .from('household_members')
      .select('age')
      .eq('user_id', profile.id)

    const ages = (members ?? []).map(m => m.age).filter((a): a is number => a !== null)

    // Auto-generate AI content for empty sections
    for (const section of sections) {
      if (['coaching', 'fun_zone', 'brain_fuel'].includes(section.section_type)) {
        const content = section.content as { generated?: boolean; content?: { title: string; body: string } }
        if (!content.content?.body) {
          const generated = await generateContent(section.section_type, ages)
          await supabase
            .from('paper_sections')
            .update({ content: { generated: true, content: generated } })
            .eq('id', section.id)
          section.content = { generated: true, content: generated }
        }
      }
    }

    // Compose the newsletter
    const html = await composeNewsletter(
      { family_name: profile.family_name },
      sections,
      weekStart
    )

    await supabase
      .from('papers')
      .update({ composed_html: html, status: 'preview' })
      .eq('id', paper.id)

    // Send preview email
    const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${paper.id}`
    await sendPreviewEmail(profile.email, profile.family_name || 'Your Family', previewUrl)

    processed++
  }

  return NextResponse.json({ processed })
}

export const maxDuration = 300
```

**Step 3: Create Sunday delivery cron**

Create `src/app/api/cron/sunday-deliver/route.ts`:

```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { composeNewsletter } from '@/lib/ai/compose'
import { generatePDF } from '@/lib/pdf'
import { sendFinalEmail } from '@/lib/email'
import { getCurrentWeekStart } from '@/lib/papers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const weekStart = getCurrentWeekStart()
  const now = new Date()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, family_name, timezone')

  if (!profiles) return NextResponse.json({ processed: 0 })

  let processed = 0

  for (const profile of profiles) {
    // Check if it's Sunday 8 AM in user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: profile.timezone }))
    if (userTime.getDay() !== 0 || userTime.getHours() !== 8) continue

    const { data: paper } = await supabase
      .from('papers')
      .select('*')
      .eq('user_id', profile.id)
      .eq('week_start', weekStart)
      .single()

    if (!paper) continue

    // Re-compose if user made edits (check if updated_at > composed time)
    // For MVP, always re-compose to pick up Saturday edits
    const { data: sections } = await supabase
      .from('paper_sections')
      .select('*')
      .eq('paper_id', paper.id)

    if (!sections) continue

    const html = await composeNewsletter(
      { family_name: profile.family_name },
      sections,
      weekStart
    )

    // Generate PDF
    const pdf = await generatePDF(html)

    // Update paper
    await supabase
      .from('papers')
      .update({ composed_html: html, status: 'final' })
      .eq('id', paper.id)

    // Send final email with PDF
    await sendFinalEmail(
      profile.email,
      profile.family_name || 'Your Family',
      pdf,
      weekStart
    )

    processed++
  }

  return NextResponse.json({ processed })
}

export const maxDuration = 300
```

**Step 4: Create vercel.json with cron schedule**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/saturday-preview",
      "schedule": "0 * * * 6"
    },
    {
      "path": "/api/cron/sunday-deliver",
      "schedule": "0 * * * 0"
    }
  ]
}
```

Note: Crons run every hour on Saturday/Sunday respectively. The route handler checks if it's 8 AM in each user's timezone.

**Step 5: Add CRON_SECRET to .env.local.example**

Add `CRON_SECRET=` to the example env file.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add email delivery with Resend and Saturday/Sunday cron jobs"
```

---

## Task 12: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Create landing page**

Replace `src/app/page.tsx` with a warm, newspaper-themed landing page:

```typescript
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-amber-50">
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="text-6xl font-serif font-bold text-stone-800 mb-4">
          Poopin' Papers
        </h1>
        <p className="text-xl text-stone-500 italic font-serif mb-12">
          The Only Newspaper Worth Sitting Down For
        </p>

        <div className="bg-white rounded-lg border-2 border-stone-800 p-8 mb-12 text-left max-w-xl mx-auto">
          <p className="text-stone-700 font-serif text-lg leading-relaxed">
            A weekly one-page family newsletter — personalized with your meal plan,
            chores, calendar, jokes, and coaching moments. AI-composed, beautifully
            printed, hung in the bathroom.
          </p>
          <p className="text-stone-500 font-serif mt-4">
            Because the best family communication happens where everyone eventually sits down.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/signup"
            className="inline-block bg-stone-800 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-stone-700"
          >
            Start Your First Issue
          </Link>
          <p className="text-sm text-stone-400">
            Free to start. Takes 2 minutes.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl mb-2">🍽️</div>
            <h3 className="font-serif font-semibold text-stone-800">Meal Plans</h3>
            <p className="text-sm text-stone-500">What's for dinner this week</p>
          </div>
          <div>
            <div className="text-3xl mb-2">🧹</div>
            <h3 className="font-serif font-semibold text-stone-800">Chores</h3>
            <p className="text-sm text-stone-500">Check 'em off as you go</p>
          </div>
          <div>
            <div className="text-3xl mb-2">🧠</div>
            <h3 className="font-serif font-semibold text-stone-800">Coaching</h3>
            <p className="text-sm text-stone-500">Weekly life lessons</p>
          </div>
        </div>

        <div className="mt-16 border-t-2 border-stone-800 pt-4">
          <p className="text-xs text-stone-400 font-serif italic">
            Est. 2026 — Printed fresh every week — Please recycle (or compost)
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify it renders**

```bash
npm run dev
```

Visit localhost:3000, verify the landing page renders.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add landing page with newspaper-themed branding"
```

---

## Task 13: Settings Page

**Files:**
- Create: `src/app/dashboard/settings/page.tsx`

**Step 1: Create settings page**

Create `src/app/dashboard/settings/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Pacific/Honolulu',
]

export default function SettingsPage() {
  const [familyName, setFamilyName] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('family_name, timezone')
        .eq('id', user.id)
        .single()
      if (data) {
        setFamilyName(data.family_name ?? '')
        setTimezone(data.timezone)
      }
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ family_name: familyName, timezone })
      .eq('id', user.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-serif font-bold text-stone-800 mb-6">Settings</h2>
      <form onSubmit={handleSave} className="bg-white rounded-lg border border-stone-200 p-6 space-y-4">
        <div>
          <label htmlFor="familyName" className="block text-sm font-medium text-stone-700">Family Name</label>
          <input
            id="familyName"
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
          />
        </div>
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-stone-700">Timezone</label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-amber-500"
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz.replace('_', ' ').replace('America/', '').replace('Pacific/', '')}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-stone-800 text-white py-2 px-4 rounded font-medium hover:bg-stone-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add settings page for family name and timezone"
```

---

## Task 14: Auto-Generate Content on First Paper Creation

**Files:**
- Modify: `src/lib/papers.ts` — update `getOrCreateCurrentPaper` to trigger AI content generation for new papers

**Step 1: Update getOrCreateCurrentPaper**

In `src/lib/papers.ts`, after inserting default sections for a new paper, call the content generation for coaching, fun_zone, and brain_fuel sections. This ensures first-time users get immediate content.

Add to `getOrCreateCurrentPaper` after the section insert:

```typescript
// Auto-generate AI content for new papers
const { data: members } = await supabase
  .from('household_members')
  .select('age')
  .eq('user_id', userId)

const ages = (members ?? []).map(m => m.age).filter((a): a is number => a !== null)

const aiSectionTypes = ['coaching', 'fun_zone', 'brain_fuel']
const { data: insertedSections } = await supabase
  .from('paper_sections')
  .select('id, section_type')
  .eq('paper_id', paper.id)
  .in('section_type', aiSectionTypes)

if (insertedSections) {
  // Import dynamically to avoid circular deps
  const { generateContent } = await import('@/lib/ai/content')
  for (const section of insertedSections) {
    const content = await generateContent(section.section_type, ages)
    await supabase
      .from('paper_sections')
      .update({ content: { generated: true, content } })
      .eq('id', section.id)
  }
}
```

**Step 2: Verify first-time flow**

Sign up as a new user, complete onboarding, land on dashboard. The coaching, fun zone, and brain fuel sections should have AI-generated content.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: auto-generate AI content for coaching/jokes/brain teasers on first paper"
```

---

## Task 15: Polish & Wire Up Remaining Pieces

**Files:**
- Modify: `src/app/globals.css` — add Georgia font and warm theme
- Create: `src/app/api/auth/signout/route.ts` (if not already created)
- Modify: `src/app/layout.tsx` — add metadata, font

**Step 1: Update global styles**

In `src/app/globals.css`, ensure Georgia serif is the default and add warm theming:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: Georgia, 'Times New Roman', serif;
  }
}
```

**Step 2: Update root layout metadata**

In `src/app/layout.tsx`, update the metadata:

```typescript
export const metadata = {
  title: "Poopin' Papers — The Only Newspaper Worth Sitting Down For",
  description: 'A weekly family newsletter with meal plans, chores, coaching, and fun — printed and hung in the bathroom.',
}
```

**Step 3: Run full build check**

```bash
npm run build
```

Fix any TypeScript or build errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish global styles, metadata, and wire up remaining pieces"
```

---

## Summary

| Task | What it builds | Depends on |
|------|---------------|------------|
| 1 | Project scaffolding | — |
| 2 | Database schema + Supabase client | 1 |
| 3 | Auth pages (signup, login, onboarding) | 2 |
| 4 | Paper data layer (CRUD helpers) | 2 |
| 5 | Dashboard + section editors | 3, 4 |
| 6 | AI content generation (Haiku) | 1 |
| 7 | Design system document | — |
| 8 | Composition engine (Sonnet) | 7 |
| 9 | PDF generation (Puppeteer) | 8 |
| 10 | Web preview page | 5, 8, 9 |
| 11 | Email delivery + cron | 6, 8, 9 |
| 12 | Landing page | 1 |
| 13 | Settings page | 3 |
| 14 | Auto-generate on first paper | 4, 6 |
| 15 | Polish & wire up | All |

**Parallelizable groups:**
- Tasks 1 must go first
- Tasks 2, 7, 12 can run in parallel after 1
- Tasks 3, 4, 6 can run in parallel after 2
- Tasks 5, 8 after their deps
- Tasks 9, 10, 11, 13, 14 after their deps
- Task 15 is the final pass
