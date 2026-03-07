import { generateContent, generateThisWeekContent } from './ai/content'
import { composeNewsletter } from './ai/compose'
import type { Audience, PaperSection, WeeklyEdition } from './types/database'

export const SHARED_AUDIENCE: Audience[] = ['kids', 'pre-teens', 'teens']

const DEFAULT_CHORES = {
  items: [
    { text: 'Make your bed every morning' },
    { text: 'Put clean laundry away' },
    { text: 'Rinse your dishes after meals' },
    { text: 'Clean your room once this week' },
  ],
}

function mockSection(
  sectionType: string,
  content: Record<string, unknown>
): PaperSection {
  return {
    id: `shared-${sectionType}`,
    paper_id: 'shared-edition',
    section_type: sectionType,
    content,
    enabled: true,
    overridden: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as PaperSection
}

export async function generateSharedEdition(weekStart: string): Promise<{
  sections: WeeklyEdition['sections']
  composed_html: string
}> {
  const [coaching, funZone, brainFuel, thisWeek] = await Promise.all([
    generateContent('coaching', SHARED_AUDIENCE),
    generateContent('fun_zone', SHARED_AUDIENCE),
    generateContent('brain_fuel', SHARED_AUDIENCE),
    generateThisWeekContent(SHARED_AUDIENCE),
  ])

  const sections: WeeklyEdition['sections'] = {
    coaching,
    fun_zone: funZone,
    brain_fuel: brainFuel,
    this_week: thisWeek,
  }

  // Build mock PaperSection array for composeNewsletter
  const paperSections: PaperSection[] = [
    mockSection('coaching', { generated: true, content: coaching }),
    mockSection('fun_zone', { generated: true, content: funZone }),
    mockSection('brain_fuel', { generated: true, content: brainFuel }),
    mockSection('this_week', thisWeek as unknown as Record<string, unknown>),
    mockSection('chores', DEFAULT_CHORES as unknown as Record<string, unknown>),
  ]

  const composed_html = await composeNewsletter(
    { family_name: 'Our Family', audience: SHARED_AUDIENCE },
    paperSections,
    weekStart,
    undefined,
    { reviewLayout: true }
  )

  return { sections, composed_html }
}
