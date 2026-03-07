# AI-Composed HTML Newsletter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace react-pdf with AI-composed HTML + Puppeteer PDF — the AI generates a complete, self-contained HTML newspaper using detailed design guidelines, preview shows that HTML in an iframe, and Puppeteer renders the same HTML to PDF.

**Architecture:** AI (Sonnet) composes full HTML document per the Hex newspaper guidelines. HTML is stored as `composed_html` on the paper record. Preview renders via iframe `srcDoc`. PDF endpoint renders the same HTML with Puppeteer. Single source of truth = the composed HTML.

**Tech Stack:** Anthropic SDK (Sonnet for compose, Haiku for content/chat), puppeteer-core + @sparticuz/chromium (PDF), Next.js App Router

---

### Task 1: Swap Dependencies

**Step 1: Install Puppeteer deps, remove react-pdf**

Run:
```bash
npm install puppeteer-core @sparticuz/chromium
npm uninstall @react-pdf/renderer
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: swap @react-pdf/renderer for puppeteer-core + @sparticuz/chromium"
```

---

### Task 2: Replace Design System with Hex Guidelines

**Files:**
- Modify: `src/lib/ai/design-system.ts`

**Step 1: Replace `design-system.ts` with the Hex newspaper guidelines**

Replace the entire `DESIGN_SYSTEM` export with the user's provided guidelines, adapted as an AI system prompt. Key specs:
- Georgia serif everywhere
- 2-column CSS grid, 8px gap, 7.5in max-width
- @page letter with 0.3in margins
- Emoji banner masthead: `🧻💩📰`
- Title: "The Poopin' Papers"
- Subtitle: "The Only Newspaper Worth Sitting Down For"
- Vol/No/date/Est. 2026 edition line
- 3px double #333 borders for masthead/footer
- Sections: 1.5px solid #333 border, 4px border-radius, 6-8px padding
- Specific section formatting (table menus, checkbox chores, Q&A jokes, quote boxes)
- Color palette: #1a1a1a body, #333 borders, subtle backgrounds per section
- Print CSS with exact color-adjust rules
- Anti-patterns list
- Tone guidelines

**Step 2: Commit**

```bash
git add src/lib/ai/design-system.ts
git commit -m "feat: replace design system with Hex newspaper guidelines"
```

---

### Task 3: Update Compose Pipeline

**Files:**
- Modify: `src/lib/ai/compose.ts`
- Modify: `src/lib/ai/content.ts`

**Step 1: Update `compose.ts`**

- Update `PAGE_CONSTRAINT_CSS` to use 0.3in margins (matching Hex spec)
- Update `buildCompositionPrompt` to pass family name, week start, issue number, audience, and section data — aligned with the new guidelines format
- Remove markdown stripping instructions from content.ts (the HTML handles formatting now)

**Step 2: Set compose model to Sonnet**

In `src/lib/ai/llm.ts` or via env var `COMPOSE_MODEL`, the compose path should default to Sonnet (`claude-sonnet-4-6`) for reliable HTML layout generation. Update the default in `llm.ts`:

```typescript
const defaultModel = purpose === 'compose'
  ? 'anthropic:claude-sonnet-4-6'
  : 'anthropic:claude-haiku-4-5-20251001'
```

**Step 3: Commit**

```bash
git add src/lib/ai/compose.ts src/lib/ai/content.ts src/lib/ai/llm.ts
git commit -m "feat: update compose pipeline for Hex guidelines + Sonnet model"
```

---

### Task 4: Create Puppeteer PDF Utility

**Files:**
- Create: `src/lib/pdf.ts`

**Step 1: Create the PDF generation utility**

```typescript
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  })

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })

  const pdf = await page.pdf({
    format: 'letter',
    margin: { top: '0.3in', right: '0.3in', bottom: '0.3in', left: '0.3in' },
    printBackground: true,
  })

  await browser.close()
  return Buffer.from(pdf)
}
```

**Step 2: Commit**

```bash
git add src/lib/pdf.ts
git commit -m "feat: add Puppeteer PDF generation utility"
```

---

### Task 5: Update PDF API Route

**Files:**
- Modify: `src/app/api/pdf/[paperId]/route.ts`

**Step 1: Rewrite to use composed_html + Puppeteer**

The route should:
1. Fetch the paper (verify ownership)
2. If `composed_html` is null, compose it first (call `composeNewsletter`)
3. Generate PDF from the HTML with `generatePDF()`
4. Return the PDF buffer

Remove all react-pdf imports.

**Step 2: Commit**

```bash
git add src/app/api/pdf/[paperId]/route.ts
git commit -m "feat: PDF route uses Puppeteer + composed HTML"
```

---

### Task 6: Update PaperView to Use Composed HTML

**Files:**
- Modify: `src/app/paper/PaperView.tsx`
- Modify: `src/app/paper/page.tsx`
- Modify: `src/app/api/generate-paper/route.ts`

**Step 1: Update `generate-paper` route to compose HTML after content gen**

After generating AI content and before returning, call `composeNewsletter()` and store the HTML:

```typescript
const html = await composeNewsletter(
  { family_name: profile?.family_name ?? null, audience },
  allSections,
  paper.week_start,
)
await supabase.from('papers').update({ composed_html: html }).eq('id', paperId)
return NextResponse.json({ sections: allSections, html, status: 'ready' })
```

**Step 2: Update `page.tsx` to pass `composed_html`**

Fetch the paper's `composed_html` and pass it to PaperView as `initialHtml`.

**Step 3: Rewrite `PaperView.tsx`**

- Remove `NewsletterPreview` import
- Accept `initialHtml: string | null` prop instead of `initialSections`
- Still accept `sections` for the generating state check
- Preview: render iframe with `srcdoc={html}`
- On generate complete: set html from response
- On chat update (`triggerRecompose`): call `/api/compose` to re-compose, update html state

**Step 4: Commit**

```bash
git add src/app/paper/PaperView.tsx src/app/paper/page.tsx src/app/api/generate-paper/route.ts
git commit -m "feat: PaperView shows composed HTML in iframe"
```

---

### Task 7: Update Sunday Deliver Cron

**Files:**
- Modify: `src/app/api/cron/sunday-deliver/route.ts`

**Step 1: Replace react-pdf with Puppeteer**

- Remove `renderToBuffer`, `NewsletterDocument`, `React` imports
- Import `generatePDF` from `@/lib/pdf`
- Use the `html` from `composeNewsletter()` to generate PDF:

```typescript
const pdfBuffer = await generatePDF(html)
```

**Step 2: Commit**

```bash
git add src/app/api/cron/sunday-deliver/route.ts
git commit -m "feat: sunday delivery uses Puppeteer for PDF"
```

---

### Task 8: Delete react-pdf Files

**Files:**
- Delete: `src/components/NewsletterPreview.tsx`
- Delete: `src/lib/pdf/newsletter-document.tsx`
- Delete: `src/lib/pdf/styles.ts`
- Delete: `src/lib/pdf/layout.ts`

**Step 1: Delete the files**

```bash
rm src/components/NewsletterPreview.tsx
rm src/lib/pdf/newsletter-document.tsx
rm src/lib/pdf/styles.ts
rm src/lib/pdf/layout.ts
```

Note: `layout.ts` exports (`SECTION_TITLES`, `COLORS`, `isSectionEmpty`, etc.) are used by `compose.ts`. Check if `compose.ts` still imports from `layout.ts`. If so, move any needed utilities (like `isSectionEmpty`, `getMealPlanHint`) into `compose.ts` before deleting.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove react-pdf components and styles"
```

---

### Task 9: Build Verification & Smoke Test

**Step 1: Full build**

```bash
npm run build
```

**Step 2: Run dev server and test the flow**

```bash
npm run dev
```

1. Navigate to `/paper`
2. Verify AI content generates
3. Verify composed HTML appears in iframe preview
4. Click "Download PDF" — verify PDF downloads
5. Check that the newspaper looks correct (Georgia font, 2-column grid, masthead, footer)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete migration to AI-composed HTML + Puppeteer PDF"
```
