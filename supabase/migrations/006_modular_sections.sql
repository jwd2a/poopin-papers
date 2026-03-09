-- Modular sections: user-configurable section preferences + custom section type

-- Add section preferences to profiles
alter table public.profiles
  add column enabled_sections text[] not null default '{this_week,coaching,fun_zone,brain_fuel,chores}',
  add column custom_section_title text,
  add column custom_section_prompt text;

-- Allow 'custom' as a section type in paper_sections
alter table public.paper_sections
  drop constraint paper_sections_section_type_check;

alter table public.paper_sections
  add constraint paper_sections_section_type_check
    check (section_type in (
      'this_week', 'meal_plan', 'chores', 'coaching', 'fun_zone', 'brain_fuel', 'custom'
    ));
