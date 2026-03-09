-- Add Stripe subscription fields to profiles
alter table public.profiles
  add column stripe_customer_id text,
  add column subscription_status text not null default 'inactive'
    check (subscription_status in ('active', 'inactive', 'past_due', 'canceled')),
  add column subscription_id text;
