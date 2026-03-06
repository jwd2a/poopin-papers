# Poopin' Papers - Design Document

**Date:** 2026-03-05
**Status:** Approved

## Overview

A web app where families sign up, configure weekly content (meals, chores, events, coaching, jokes, brain teasers), and receive an AI-composed, printable one-page PDF newsletter every week. Each issue is uniquely composed -- not a template fill-in -- with a consistent newspaper design language.

**Tagline:** "The Only Newspaper Worth Sitting Down For"

## Architecture

Three-layer system:

1. **Platform** -- Next.js app handling auth, editor UI, settings, cron jobs, and email delivery
2. **Content Engine** -- Claude Haiku 4.5 generates section content (coaching lessons, jokes, brain teasers, fun facts)
3. **Composition Engine** -- Claude Sonnet 4.6 takes a design system document + that week's content and composes unique HTML, which Puppeteer renders to PDF

The composition engine is the key differentiator. A design system document defines the visual language (Georgia serif, newspaper aesthetic, warm/playful tone, print-optimized, letter-size single page). The AI composes each issue uniquely while maintaining visual consistency -- like a real newspaper art director working with the same masthead and style guide but creating a fresh layout every issue.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Auth:** Supabase Auth
- **Database:** Supabase (Postgres)
- **Content AI:** Claude Haiku 4.5 (Anthropic SDK)
- **Composition AI:** Claude Sonnet 4.6 (Anthropic SDK)
- **PDF:** @sparticuz/chromium + puppeteer-core
- **Email:** Resend
- **Hosting:** Vercel
- **Styling:** Tailwind CSS

## Data Model

### Users
- id, email, created_at, timezone, family_name

### Household Members (optional)
- id, user_id, name, age, role (parent/kid)

### Papers
- id, user_id, week_start (date), status (draft/preview/final), created_at, updated_at

### Paper Sections
- id, paper_id, section_type, content (jsonb), enabled (bool)
- Section types: this_week, meal_plan, chores, coaching, fun_zone, brain_fuel

### Content JSONB Structures

**meal_plan:**
```json
{
  "meals": {
    "sunday": { "breakfast": "Crepes", "lunch": "Grilled Cheese", "dinner": "Lasagna" },
    "monday": { "breakfast": "Cereal", "lunch": "", "dinner": "Tacos" }
  }
}
```

**chores:**
```json
{
  "items": [
    { "text": "Make your bed every morning", "assignee": null },
    { "text": "Feed the dog", "assignee": "Miles" }
  ]
}
```

**this_week:**
```json
{
  "items": [
    { "text": "Dance class Tuesday -- bag packed before dinner", "icon": "dance" },
    { "text": "Daylight Saving Time Sunday!", "icon": "clock" }
  ]
}
```

**coaching / fun_zone / brain_fuel:**
```json
{
  "generated": true,
  "content": {
    "title": "Be the Thermostat, Not the Thermometer",
    "body": "A thermometer just reacts to the temperature around it..."
  }
}
```

## User Flow

1. **Sign up** -- email/password via Supabase Auth
2. **Onboarding** -- family name, kids' names/ages (optional), timezone
3. **Dashboard** -- section editors for each content type
4. **On-demand preview** -- generate and print immediately at any point
5. **Weekly cycle:**
   - Saturday AM (user's TZ): email with preview link, edit window all day
   - Sunday AM (user's TZ): final PDF emailed as attachment

### First-Time Experience

Immediate satisfaction is critical. On first signup:
- AI generates defaults for all sections (coaching, jokes, brain teasers)
- Default chores provided
- Meal plan and This Week can be empty -- the composition adapts gracefully
- User can print their first issue immediately with zero manual input

## Composition Engine (Key Differentiator)

Sections are optional and fluid. The AI composition engine:
- Receives the week's content (whatever sections have data)
- Follows a design system document (fonts, borders, spacing rules, visual patterns)
- Composes unique HTML that fills a single letter-size page
- Adapts layout to available content -- no empty grids, no wasted space
- Maintains visual consistency week-to-week without being rigidly templated

The design system is a separate, decoupled concern. Future: multiple themes, holiday editions, seasonal variations.

## Sections

| Section | Content Source | Fallback (empty) |
|---------|--------------|-------------------|
| This Week | Manual entry | AI generates based on date/season |
| Meal Plan | Manual grid | Omitted gracefully |
| Chores | Manual list (defaults provided) | Default chores |
| Coaching Corner | AI-generated (Haiku) or manual | Always AI-generated |
| Fun Zone | AI-generated (Haiku) or manual | Always AI-generated |
| Brain Fuel | AI-generated (Haiku) or manual | Always AI-generated |

## Email Schedule

Single cron job runs hourly, queries users by timezone:
- **Saturday 8 AM (user's TZ):** Generate preview, email link
- **Sunday 8 AM (user's TZ):** Finalize, render PDF, email with attachment

## MVP Scope

### Must Have
- Landing page with signup
- Dashboard with section editors
- AI content generation (Haiku)
- AI layout composition (Sonnet)
- PDF generation via Puppeteer
- Web preview page
- Email delivery (Saturday preview + Sunday PDF)
- Basic account settings
- On-demand preview/print

### Nice to Have (Post-MVP)
- Google Calendar sync (OAuth)
- Custom themes/colors
- Multiple papers per household
- Shopping list (derived from meal plan)
- Mobile-friendly editor
- Stripe subscription

### Out of Scope
- Native mobile app
- Team/shared editing
- Print-and-ship physical copies
- Social features
