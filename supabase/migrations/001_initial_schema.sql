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
