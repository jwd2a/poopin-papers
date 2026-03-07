import { complete } from './llm'
import { DESIGN_SYSTEM } from './design-system'
import { screenshotHTML } from '@/lib/pdf'
import Anthropic from '@anthropic-ai/sdk'
import type { PaperSection, Profile, Audience } from '@/lib/types/database'

function isSectionEmpty(section: PaperSection): boolean {
  const content = section.content as Record<string, unknown>

  if (section.section_type === 'meal_plan') {
    const meals = content.meals as Record<string, Record<string, string>> | undefined
    if (!meals) return true
    return Object.values(meals).every(day =>
      Object.values(day).every(meal => !meal || meal.trim() === '')
    )
  }

  if (section.section_type === 'this_week' || section.section_type === 'chores') {
    const items = content.items as unknown[] | undefined
    return !items || items.length === 0
  }

  if (['coaching', 'fun_zone', 'brain_fuel'].includes(section.section_type)) {
    if (content.generated === false) return true
    const inner = content.content as { title?: string; body?: string } | undefined
    return !inner?.body
  }

  return false
}

function getMealPlanHint(content: Record<string, unknown>): string {
  const meals = content.meals as Record<string, Record<string, string>> | undefined
  if (!meals) return ''

  const filledSlots: string[] = []
  const filledDays = new Set<string>()
  const filledTypes = new Set<string>()

  for (const [day, dayMeals] of Object.entries(meals)) {
    for (const [type, meal] of Object.entries(dayMeals)) {
      if (meal && meal.trim()) {
        filledSlots.push(`${day} ${type}: ${meal}`)
        filledDays.add(day)
        filledTypes.add(type)
      }
    }
  }

  if (filledSlots.length === 0) return ''

  const hints: string[] = []
  if (filledTypes.size === 1) {
    hints.push(`Only ${[...filledTypes][0]}s are filled in — show as a simple ${[...filledTypes][0]} list, not a full 7-day grid.`)
  }
  if (filledDays.size <= 3) {
    hints.push(`Only ${filledDays.size} days have meals — show only those days, not the full week.`)
  }
  if (filledSlots.length <= 4) {
    hints.push('Very few meals set — use a compact list format instead of a table.')
  }

  return hints.length > 0 ? `\n**Layout hint:** ${hints.join(' ')}` : ''
}

function buildCompositionPrompt(
  profile: Pick<Profile, 'family_name'> & { audience?: Audience[] },
  sections: PaperSection[],
  weekStart: string,
  issueNumber?: number
): string {
  const liveSections = sections.filter(s => s.enabled && !isSectionEmpty(s))

  const sectionData = liveSections.map(s => {
    let extra = ''
    if (s.section_type === 'meal_plan') {
      extra = getMealPlanHint(s.content as Record<string, unknown>)
    }
    return `### ${s.section_type}\n${JSON.stringify(s.content, null, 2)}${extra}`
  }).join('\n\n')

  const audienceHint = profile.audience && profile.audience.length > 0
    ? `\n**Target Audience:** ${profile.audience.join(', ')} — tailor the visual style, typography size, and overall feel to these age groups.`
    : ''

  return `Compose a single-page printable HTML newsletter with the following data:

**Family Name:** ${profile.family_name || 'Our Family'}
**Week of:** ${weekStart}
${issueNumber ? `**Issue #:** ${issueNumber}` : ''}${audienceHint}

## Sections to include (ONLY these — do not invent or show sections not listed):
${sectionData}

${liveSections.length < 6 ? `\nThis week has ${liveSections.length} sections. Use the extra space well — give sections more room to breathe, use larger type, or add creative whitespace. NEVER show empty placeholder sections.` : ''}

CRITICAL RULES:
- Render the section data AS-IS. Do not rewrite, expand, or add content beyond what's provided.
- For sections with a "content" field containing "body", render that body text directly.
- Everything must fit on ONE page (10in live area). If content is long, TRUNCATE it — never spill to page 2.
- Use the exact CSS skeleton from the design system. Do not improvise layout.
- Return ONLY the complete HTML document.`
}

const LAYOUT_REVIEW_PROMPT = `You are a print layout QA reviewer for a one-page family newspaper called "The Poopin' Papers."

Look at this screenshot of the rendered newsletter and evaluate ONLY the layout/visual quality. Check for:

1. **Overflow**: Does any content get cut off or extend beyond the page? Are any sections overflowing?
2. **Balance**: Are paired columns (left/right) roughly the same height? Is there large empty white space anywhere?
3. **Spacing**: Is padding/margin consistent between sections? Is anything too cramped or too loose?
4. **Alignment**: Are section borders, headers, and text properly aligned?
5. **Footer**: Is the footer visible at the bottom of the page?
6. **Readability**: Is font size appropriate? Is there enough contrast?

If the layout looks GOOD (no major issues), respond with exactly: APPROVED

If there are issues, respond with a SHORT bulleted list of specific CSS/layout fixes needed. Be precise — reference specific sections by name and give exact CSS property suggestions. Do NOT rewrite the HTML yourself. Keep feedback to 3-5 bullets max.`

async function reviewLayout(screenshotBuffer: Buffer): Promise<string | null> {
  const client = new Anthropic()
  const base64 = screenshotBuffer.toString('base64')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: base64 },
        },
        { type: 'text', text: LAYOUT_REVIEW_PROMPT },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  if (text.trim().startsWith('APPROVED')) return null
  return text.trim()
}

export async function composeNewsletter(
  profile: Pick<Profile, 'family_name'> & { audience?: Audience[] },
  sections: PaperSection[],
  weekStart: string,
  issueNumber?: number,
  { reviewLayout: shouldReview = true }: { reviewLayout?: boolean } = {}
): Promise<string> {
  const prompt = buildCompositionPrompt(profile, sections, weekStart, issueNumber)

  // Round 1: Generate initial HTML
  const { text } = await complete('compose', {
    system: DESIGN_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 8192,
  })

  let html = stripCodeFences(text)
  html = injectPageConstraints(html)

  if (!shouldReview) return html

  // Vision QA loop — up to 2 revision rounds
  const MAX_REVISIONS = 2
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: prompt },
    { role: 'assistant', content: html },
  ]

  for (let i = 0; i < MAX_REVISIONS; i++) {
    try {
      const screenshot = await screenshotHTML(html)
      const feedback = await reviewLayout(screenshot)

      if (!feedback) break // APPROVED — no changes needed

      console.log(`[compose] Revision ${i + 1} — reviewer notes: ${feedback}`)

      // Ask Sonnet to revise based on feedback
      messages.push({
        role: 'user',
        content: `A layout reviewer checked the rendered output and found these issues:\n\n${feedback}\n\nPlease fix these layout issues in the HTML. Return the COMPLETE revised HTML document — not a diff or partial update.`,
      })

      const revision = await complete('compose', {
        system: DESIGN_SYSTEM,
        messages,
        maxTokens: 8192,
      })

      html = stripCodeFences(revision.text)
      html = injectPageConstraints(html)
      messages.push({ role: 'assistant', content: html })
    } catch (err) {
      console.error(`[compose] Revision ${i + 1} failed, using current HTML:`, err)
      break
    }
  }

  return html
}

function stripCodeFences(text: string): string {
  return text.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim()
}

const PAGE_CONSTRAINT_CSS = `
/* Print safety net — does NOT override layout CSS from the AI */
@page { size: letter; margin: 0.3in; }
@media print {
  body { overflow: hidden; }
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
`

function injectPageConstraints(html: string): string {
  const styleTag = `<style>${PAGE_CONSTRAINT_CSS}</style>`

  if (html.includes('</head>')) {
    return html.replace('</head>', styleTag + '</head>')
  }

  return styleTag + html
}
