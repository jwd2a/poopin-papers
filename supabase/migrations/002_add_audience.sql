-- Add audience column to profiles for age-appropriate content generation
alter table public.profiles
  add column audience text not null default 'kids'
  check (audience in ('toddlers', 'kids', 'pre-teens', 'teens', 'adults'));
