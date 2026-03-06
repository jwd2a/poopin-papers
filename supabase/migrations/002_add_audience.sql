-- Add audience column to profiles for age-appropriate content generation
-- Stored as a JSON array of audience values, e.g. ["kids", "teens"]
alter table public.profiles
  add column audience jsonb not null default '["kids"]'::jsonb;
