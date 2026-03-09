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
