# Stripe Subscription Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add $5/month subscription paywall using Stripe Checkout, gating access after signup and before onboarding.

**Architecture:** Stripe Checkout handles payment UI. Webhooks sync subscription status to `profiles` table. Middleware checks `subscription_status` or `is_admin` before allowing access to protected routes.

**Tech Stack:** Stripe SDK (`stripe`), Next.js API routes, Supabase (profiles table), Stripe Customer Portal for subscription management.

**Stripe Resources (already created):**
- Product ID: `prod_U7Nrhg6a5a4SWS`
- Price ID: `price_0T995nUYpWUgnHYRpA52b0Hg`

---

### Task 1: Install Stripe SDK and add env vars

**Files:**
- Modify: `package.json`
- Modify: `.env.local` (manually — add keys)

**Step 1: Install stripe**

Run: `npm install stripe`

**Step 2: Add env vars to .env.local**

Add these to `.env.local`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add stripe SDK dependency"
```

---

### Task 2: Database migration — add subscription fields to profiles

**Files:**
- Create: `supabase/migrations/007_stripe_subscription.sql`
- Modify: `src/lib/types/database.ts:1-16`

**Step 1: Write the migration**

Create `supabase/migrations/007_stripe_subscription.sql`:

```sql
-- Add Stripe subscription fields to profiles
alter table public.profiles
  add column stripe_customer_id text,
  add column subscription_status text not null default 'inactive'
    check (subscription_status in ('active', 'inactive', 'past_due', 'canceled')),
  add column subscription_id text;
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset`
Expected: Database resets with new columns

**Step 3: Update TypeScript types**

Modify `src/lib/types/database.ts` — add to the `Profile` type:

```typescript
export type Profile = {
  id: string
  email: string
  family_name: string | null
  timezone: string
  audience: Audience[]
  intranet_url: string | null
  is_admin: boolean
  enabled_sections: SectionType[]
  custom_section_title: string | null
  custom_section_prompt: string | null
  stripe_customer_id: string | null
  subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled'
  subscription_id: string | null
  created_at: string
  updated_at: string
}
```

**Step 4: Commit**

```bash
git add supabase/migrations/007_stripe_subscription.sql src/lib/types/database.ts
git commit -m "feat: add stripe subscription fields to profiles"
```

---

### Task 3: Create Stripe helper library

**Files:**
- Create: `src/lib/stripe.ts`

**Step 1: Create the Stripe client module**

Create `src/lib/stripe.ts`:

```typescript
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-18.acacia',
})

export const PRICE_ID = 'price_0T995nUYpWUgnHYRpA52b0Hg'
```

**Step 2: Commit**

```bash
git add src/lib/stripe.ts
git commit -m "feat: add stripe client library"
```

---

### Task 4: Create Checkout session API route

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`

**Step 1: Create the checkout route**

Create `src/app/api/stripe/checkout/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_ID } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    mode: 'subscription',
    success_url: `${appUrl}/onboarding`,
    cancel_url: `${appUrl}/subscribe`,
    metadata: { supabase_user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
```

**Step 2: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat: add stripe checkout session API route"
```

---

### Task 5: Create Stripe webhook handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Step 1: Create the webhook route**

Create `src/app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Use service role client to bypass RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      if (!userId) break

      // Get subscription ID from session
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id

      await supabase
        .from('profiles')
        .update({
          stripe_customer_id: session.customer as string,
          subscription_status: 'active',
          subscription_id: subscriptionId || null,
        })
        .eq('id', userId)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id

      const statusMap: Record<string, string> = {
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'inactive',
        incomplete: 'inactive',
        incomplete_expired: 'inactive',
        trialing: 'active',
        paused: 'inactive',
      }

      const mappedStatus = statusMap[subscription.status] || 'inactive'

      await supabase
        .from('profiles')
        .update({ subscription_status: mappedStatus })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id

      await supabase
        .from('profiles')
        .update({
          subscription_status: 'inactive',
          subscription_id: null,
        })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: add stripe webhook handler for subscription events"
```

---

### Task 6: Create /subscribe page

**Files:**
- Create: `src/app/subscribe/page.tsx`

**Step 1: Create the subscribe page**

Create `src/app/subscribe/page.tsx`:

```tsx
'use client'

import { useState } from 'react'

export default function SubscribePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Something went wrong')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <h1 className="font-serif text-3xl font-bold text-stone-800 mb-2">
          Poopin&apos; Papers
        </h1>
        <p className="text-sm text-stone-500 mb-8">
          A family newspaper, delivered weekly
        </p>

        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 mb-6">
          <p className="text-4xl font-bold text-stone-800 mb-1">$5</p>
          <p className="text-stone-600 text-sm">per month</p>

          <ul className="mt-4 space-y-2 text-left text-sm text-stone-700">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">&#10003;</span>
              Weekly AI-generated family newsletter
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">&#10003;</span>
              Meal plans, chores, coaching &amp; more
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">&#10003;</span>
              Printable PDF delivered to your inbox
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">&#10003;</span>
              Customize sections for your family
            </li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Redirecting to checkout...' : 'Subscribe Now'}
        </button>

        <p className="mt-4 text-xs text-stone-400">
          Cancel anytime. Powered by Stripe.
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/subscribe/page.tsx
git commit -m "feat: add subscribe page with pricing and checkout button"
```

---

### Task 7: Update middleware to gate on subscription

**Files:**
- Modify: `src/lib/supabase/middleware.ts:28-63`

**Step 1: Update middleware**

Replace the section after `const { data: { user } } = await supabase.auth.getUser()` in `src/lib/supabase/middleware.ts` with subscription checking logic:

```typescript
  const { data: { user } } = await supabase.auth.getUser()

  const publicRoutes = ['/', '/login', '/signup', '/auth/callback']
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname)
  const isCronRoute = request.nextUrl.pathname.startsWith('/api/cron/')
  const isWebhookRoute = request.nextUrl.pathname === '/api/stripe/webhook'
  const isSubscribeRoute = request.nextUrl.pathname === '/subscribe'
  const isCheckoutRoute = request.nextUrl.pathname === '/api/stripe/checkout'
  const isSignoutRoute = request.nextUrl.pathname === '/api/auth/signout'

  if (!user && !isPublicRoute && !isCronRoute && !isWebhookRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/paper'
    return NextResponse.redirect(url)
  }

  // Check subscription status for authenticated users on protected routes
  if (user && !isPublicRoute && !isCronRoute && !isWebhookRoute && !isSubscribeRoute && !isCheckoutRoute && !isSignoutRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_name, subscription_status, is_admin')
      .eq('id', user.id)
      .single()

    // Admin bypass — skip subscription check
    if (profile?.is_admin) {
      // Allow onboarding redirect for admins too
      if (request.nextUrl.pathname === '/onboarding' && profile?.family_name) {
        const url = request.nextUrl.clone()
        url.pathname = '/paper'
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    // Not subscribed — redirect to /subscribe
    if (profile?.subscription_status !== 'active') {
      const url = request.nextUrl.clone()
      url.pathname = '/subscribe'
      return NextResponse.redirect(url)
    }

    // Allow onboarding for users who haven't completed it (no family_name)
    if (request.nextUrl.pathname === '/onboarding' && profile?.family_name) {
      const url = request.nextUrl.clone()
      url.pathname = '/paper'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat: gate protected routes on subscription status in middleware"
```

---

### Task 8: Update signup to redirect to /subscribe instead of /onboarding

**Files:**
- Modify: `src/app/signup/page.tsx:42`

**Step 1: Change redirect**

In `src/app/signup/page.tsx`, change line 42 from:
```typescript
    router.push('/onboarding')
```
to:
```typescript
    router.push('/subscribe')
```

**Step 2: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "feat: redirect signup to subscribe page"
```

---

### Task 9: Add "Manage Subscription" to settings page

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`
- Create: `src/app/api/stripe/portal/route.ts`

**Step 1: Create the portal API route**

Create `src/app/api/stripe/portal/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appUrl}/dashboard/settings`,
  })

  return NextResponse.json({ url: session.url })
}
```

**Step 2: Add manage subscription button to settings**

In `src/app/dashboard/settings/page.tsx`, add a "Manage Subscription" section after the save button `</form>` closing tag (before the closing `</div>`):

```tsx
      {/* Manage Subscription */}
      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Subscription</h2>
        <p className="mb-4 text-sm text-stone-600">
          Manage your billing, update payment method, or cancel your subscription.
        </p>
        <button
          onClick={async () => {
            const res = await fetch('/api/stripe/portal', { method: 'POST' })
            const data = await res.json()
            if (data.url) window.location.href = data.url
          }}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          Manage Subscription
        </button>
      </div>
```

**Step 3: Commit**

```bash
git add src/app/api/stripe/portal/route.ts src/app/dashboard/settings/page.tsx
git commit -m "feat: add stripe customer portal for subscription management"
```

---

### Task 10: Final verification

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run tests**

Run: `npm test`
Expected: All existing tests pass

**Step 3: Manual testing checklist**

1. Sign up a new user → should redirect to `/subscribe`
2. Click "Subscribe Now" → should redirect to Stripe Checkout
3. Complete checkout → should redirect to `/onboarding`
4. After onboarding → should reach `/paper`
5. Set `is_admin = true` on a user → should bypass subscription check
6. In settings → "Manage Subscription" opens Stripe Customer Portal

**Step 4: Final commit if any fixes needed**
