# Poopin' Papers - Agent Guidelines

## Development Rules

- **Always develop locally.** Use Supabase local dev (`npx supabase start`) and `npm run dev`. Never connect to or modify production directly.
- **Never touch prod.** All changes go through local dev -> commit -> deploy pipeline. No direct database edits, no prod API calls during development.

## Tech Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Auth + Postgres) - local dev via `npx supabase start`
- Anthropic SDK (Claude Haiku 4.5 for content, Claude Sonnet 4.6 for composition)
- Puppeteer (`@sparticuz/chromium` + `puppeteer-core`) for PDF generation
- Resend for email delivery
- Vercel for hosting

## Local Development

```bash
supabase start            # Start local Supabase (DB + Auth)
supabase db reset         # Apply migrations (resets DB)
npm run dev               # Start Next.js dev server (port 3000)
npm test                  # Run tests (vitest)
npm run build             # Verify production build
```

### Local Ports (offset from defaults to avoid conflicts)

- API: http://127.0.0.1:54331
- DB: postgresql://postgres:postgres@127.0.0.1:54332/postgres
- Studio: http://127.0.0.1:54333
- Mailpit (email testing): http://127.0.0.1:54334
- App: http://localhost:3000

### Local Auth

Email confirmations are disabled in local dev. Sign up works immediately without email verification. Emails can be viewed in Mailpit at http://127.0.0.1:54334.

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/lib/` - Core libraries (supabase clients, AI modules, PDF, email)
- `src/components/` - React components (section editors)
- `supabase/migrations/` - Database migrations
- `docs/plans/` - Design docs and implementation plans
