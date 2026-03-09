# Modular Newsletter Sections — Design

## Goal

Let users configure which sections appear in their newsletter (up to 6), including an optional Custom section with a user-defined title and AI generation prompt. Preset sections can be toggled on/off in settings. Configuration persists across weeks.

## Section Types

7 available section types (max 6 enabled at a time):

- **This Week** (`this_week`) — weekly events/activities with icon bullets
- **Coaching** (`coaching`) — AI-generated parenting/family coaching tip
- **Fun Zone** (`fun_zone`) — AI-generated jokes, activities, games
- **Brain Fuel** (`brain_fuel`) — AI-generated riddle, fun fact, learning prompt
- **Chores** (`chores`) — user-managed chore list with assignees
- **Meal Plan** (`meal_plan`) — user-managed weekly meal grid
- **Custom** (`custom`) — user-defined title + AI-generated content from user's prompt

Default enabled: `this_week`, `coaching`, `fun_zone`, `brain_fuel`, `chores` (5 of 6 slots).

## Schema Changes

### `profiles` table

- Add `enabled_sections text[] not null default '{this_week,coaching,fun_zone,brain_fuel,chores}'`
- Add `custom_section_title text`
- Add `custom_section_prompt text`

### `paper_sections` table

- Update CHECK constraint on `section_type` to include `'custom'`

### TypeScript types

- Add `'custom'` to `SectionType` union
- Add `enabled_sections`, `custom_section_title`, `custom_section_prompt` to `Profile`

## Settings UI

New "Newsletter Sections" card on the Settings page (`/dashboard/settings`):

- List of 7 toggles, each showing the section name
- When 6 sections are already enabled, remaining toggles are disabled (greyed out)
- When Custom is toggled on, two fields appear inline:
  - **Title** — text input, e.g., "Bible Verse"
  - **Description** — textarea, e.g., "Find a relevant bible verse and write a short family reflection prompt for families"
- Saves with the existing Save button

## Generation Flow

### Preset sections (no change to shared edition)

`getDefaultSections()` checks `profile.enabled_sections` and only creates `paper_sections` rows for sections the user has enabled. Shared edition content populates enabled preset sections as before.

### Custom section (per-user, on demand)

When a user's paper is created and `custom` is in their `enabled_sections`:

1. A `paper_sections` row is created with `section_type: 'custom'` and `{ generated: false, content: { title: '', body: '' } }`
2. During `/api/generate-paper`, if the custom section isn't yet generated, call Haiku with the user's `custom_section_prompt` to generate `{ title, body }` content
3. The title from `profile.custom_section_title` is used as the section header in composition
4. Content shape: `{ generated: true, content: { title: string, body: string } }` — same as coaching/fun_zone/brain_fuel

### Cost

One additional Haiku call per user per week (~$0.002). Negligible at $5/mo pricing.

## Composer

The composition prompt already receives all enabled sections. Custom section renders like any other generated section — the user's `custom_section_title` becomes the section header.

## Chat

Chat can edit custom section content the same way it edits coaching/fun_zone/brain_fuel. The system prompt dynamically includes custom section info when present.

## What Doesn't Change

- Shared edition pipeline (still generates 4 preset AI sections for the global edition)
- Saturday cron flow (copies shared edition into user papers, skips custom)
- Editorial review workflow (unaffected — custom sections are per-user)
- Advanced editor (`GeneratedContentEditor` already handles the `{ title, body }` shape)

## Future: Section Marketplace

Custom sections lay the groundwork for a marketplace of pre-packaged section templates. A marketplace entry is just a `{ title, prompt }` pair that users can install instead of writing their own description. This requires no additional architecture — just a UI for browsing and selecting templates that populate `custom_section_title` and `custom_section_prompt`.
