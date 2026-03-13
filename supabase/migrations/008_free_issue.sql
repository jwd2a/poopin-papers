-- Add free_issue_used flag to profiles for the free first issue flow
alter table public.profiles
  add column free_issue_used boolean not null default false;
