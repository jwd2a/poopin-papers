-- Shared weekly editions: one set of AI content generated for all users
create table public.weekly_editions (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  sections jsonb not null default '{}'::jsonb,
  composed_html text,
  issue_number integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.weekly_editions enable row level security;

create policy "Authenticated users can read weekly editions"
  on public.weekly_editions for select
  using (auth.role() = 'authenticated');

-- Track whether a user has overridden a shared section with custom content
alter table public.paper_sections
  add column overridden boolean not null default false;
