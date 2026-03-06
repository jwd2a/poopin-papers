# Magic-First UX Redesign

**Date:** 2026-03-06
**Status:** Approved

## Overview

Redesign the post-signup experience from "editor-first" to "magic-first." The app becomes a single-screen experience: newsletter on the left, chat sidebar on the right. Signup drops you straight into a ready-to-print, AI-generated first issue with zero setup. You talk to it to customize.

## User Flow

1. Sign up -- email/password only. No onboarding.
2. Immediately see your first newsletter -- fully composed with AI defaults (coaching, jokes, brain teasers, seasonal "This Week" items). Family name defaults to "Your Family," timezone auto-detected from browser.
3. Chat sidebar -- type naturally ("Add taco Tuesday") or use preset quick-picks to learn what's possible.
4. Newsletter re-composes in the background after changes.
5. Print/download anytime via toolbar buttons.

## Single Screen Layout

```
+-----------------------------------------------------------+
|  Poopin' Papers            [Settings] [Print] [Download]  |
+-------------------------------------+---------------------+
|                                     | Add something to    |
|                                     | this week's paper   |
|                                     |                     |
|   [Newsletter Preview               | +---------------+   |
|    rendered in iframe               | | Type here...  |   |
|    at letter-size                   | +---------------+   |
|    proportions]                     |                     |
|                                     | Quick adds:         |
|                                     | [Meal] [Event]      |
|                                     | [Chore] [Custom]    |
|                                     |                     |
|                                     | -- History --       |
|                                     | > Added tacos Wed   |
|                                     | > Added soccer Tue  |
|                                     | > New coaching msg   |
|                                     |                     |
+-------------------------------------+---------------------+
```

## Chat Flow (Hybrid)

1. User types or picks a preset
2. AI (Haiku) interprets the input, determines which section(s) to update, updates data in Supabase immediately
3. A debounced re-compose (Sonnet) kicks off in the background
4. Newsletter iframe refreshes with the new composition
5. If user makes multiple changes quickly, only one re-compose fires after they stop

## Preset Quick-Picks

- **Meal** -- "What meal? (e.g., Tacos for Wednesday dinner)"
- **Event** -- "What's happening? (e.g., Soccer practice Tuesday at 5)"
- **Chore** -- "What chore? (e.g., Feed the dog -- assigned to Miles)"
- **Custom** -- freeform, AI figures it out

Each preset pre-fills the input with a hint. User can always just type freely.

## What Changes from Current Build

| Current | New |
|---------|-----|
| Onboarding page | Killed. Defaults + auto-detect. Settings accessible later. |
| Dashboard with section editors | Replaced by chat sidebar as primary. Editor still exists at /dashboard as power-user fallback. |
| Separate preview page | Newsletter is the main view. |
| "Compose" button to generate | Auto-composes on signup and after each chat interaction. |
| Section-by-section editing | Talk to it naturally. AI routes to the right section. |

## New API: POST /api/chat

Takes user message + paper ID. Uses Haiku to:
1. Parse intent (what section, what action)
2. Update the relevant section data in Supabase
3. Return confirmation message + trigger re-compose flag

## Auto-Detect Timezone

Use `Intl.DateTimeFormat().resolvedOptions().timeZone` on the client to auto-set timezone on signup. No user input needed.

## First Issue Generation (on signup)

1. Create profile with defaults (family name: "Your Family", timezone: auto-detected)
2. Create paper for current week
3. Generate AI content for coaching, fun_zone, brain_fuel (Haiku)
4. Generate seasonal/date-aware "This Week" items (Haiku)
5. Compose full newsletter (Sonnet)
6. User sees it immediately

## Tech Notes

- Existing section editors and dashboard remain as power-user fallback
- Compose debounce: 2-3 seconds after last chat message before triggering Sonnet
- Chat history stored per-paper (simple array in a new column or separate table)
- The chat API uses Haiku with structured output to route messages to the correct section data updates
