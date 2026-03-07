# Admin Editions Page Design

## Goal

Admin page at `/admin/editions` to view, edit, and regenerate shared weekly editions.

## Features

- List all editions (week date, issue number, created date, content previews)
- Detail view with editable section content (title/body for AI sections, items for this_week)
- Preview composed HTML in iframe
- Regenerate button to re-run AI generation
- Save button to persist manual edits and re-compose HTML
- "Generate Next Week" button for manual edition creation

## Auth

Any logged-in user can access (no role system needed yet).

## API Routes

- `GET /api/admin/editions` — list all editions
- `GET /api/admin/editions/[id]` — single edition
- `PUT /api/admin/editions/[id]` — update sections + re-compose HTML
- `POST /api/admin/editions/generate` — generate next week's edition (or regenerate existing by week_start)

## Pages

- `/admin/editions` — server component, lists editions
- `/admin/editions/[id]` — client component, edit/preview/regenerate
