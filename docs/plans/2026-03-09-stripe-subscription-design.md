# Stripe Subscription Design

## Flow
```
Signup → Stripe Checkout → Onboarding → /paper
```

## Stripe Setup
- **Product:** "Poopin' Papers" subscription
- **Price:** $5/month recurring

## Database Changes
Add to `profiles` table:
- `stripe_customer_id` (text, nullable)
- `subscription_status` (text, default 'inactive') — values: 'active', 'inactive', 'past_due', 'canceled'
- `subscription_id` (text, nullable)

## Middleware Gate
- After auth check, verify `subscription_status = 'active'` OR `is_admin = true`
- If not subscribed, redirect to `/subscribe`
- Exempt routes: `/subscribe`, `/api/stripe/webhook`, `/auth/callback`, `/login`, `/signup`, public routes

## New Routes
- **`/subscribe`** — Pricing info + "Subscribe" button → creates Stripe Checkout session
- **`/api/stripe/checkout`** — Creates Checkout session, returns URL
- **`/api/stripe/webhook`** — Handles Stripe events:
  - `checkout.session.completed` → set status to 'active', store customer_id + subscription_id
  - `customer.subscription.updated` → sync status
  - `customer.subscription.deleted` → set status to 'inactive'

## Environment Variables
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Manage Subscription
- "Manage Subscription" link in settings → Stripe Customer Portal (no custom billing UI)

## Admin Bypass
- Users with `is_admin = true` skip payment check
