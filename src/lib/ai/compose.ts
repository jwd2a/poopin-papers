import { complete } from './llm'
import { DESIGN_SYSTEM } from './design-system'
import type { PaperSection, Profile, Audience } from '@/lib/types/database'

function isSectionEmpty(section: PaperSection): boolean {
  const content = section.content as Record<string, unknown>

  if (section.section_type === 'meal_plan') {
    const meals = content.meals as Record<string, Record<string, string>> | undefined
    if (!meals) return true
    // Empty if every meal slot is blank
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

Follow the design system exactly. Return ONLY the complete HTML document.`
}

export async function composeNewsletter(
  profile: Pick<Profile, 'family_name'> & { audience?: Audience[] },
  sections: PaperSection[],
  weekStart: string,
  issueNumber?: number
): Promise<string> {
  const prompt = buildCompositionPrompt(profile, sections, weekStart, issueNumber)

  const { text } = await complete('compose', {
    system: DESIGN_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 8192,
  })

  // Strip any markdown code fences if present
  return text.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim()
}
