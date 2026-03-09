import type { Paper, SectionType, WeeklyEdition } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export function getCurrentWeekStart(now: Date = new Date()): string {
  const date = new Date(now)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  return date.toISOString().split('T')[0]
}

export async function getSharedEdition(
  supabase: SupabaseClient,
  weekStart: string,
): Promise<WeeklyEdition | null> {
  const { data } = await supabase
    .from('weekly_editions')
    .select('*')
    .eq('week_start', weekStart)
    .single()

  return (data as WeeklyEdition) ?? null
}

export function getDefaultSections(
  edition?: WeeklyEdition | null,
  enabledSections: SectionType[] = ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'],
  customTitle?: string | null,
): Array<{
  section_type: SectionType
  content: Record<string, unknown>
  enabled: boolean
  overridden: boolean
}> {
  const hasEdition = !!edition

  const allSections = [
    {
      section_type: 'this_week',
      content: hasEdition && edition.sections.this_week
        ? { items: edition.sections.this_week.items }
        : { items: [] },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'meal_plan',
      content: {
        meals: {
          sunday: { breakfast: '', lunch: '', dinner: '' },
          monday: { breakfast: '', lunch: '', dinner: '' },
          tuesday: { breakfast: '', lunch: '', dinner: '' },
          wednesday: { breakfast: '', lunch: '', dinner: '' },
          thursday: { breakfast: '', lunch: '', dinner: '' },
          friday: { breakfast: '', lunch: '', dinner: '' },
          saturday: { breakfast: '', lunch: '', dinner: '' },
        },
      },
      enabled: false,
      overridden: false,
    },
    {
      section_type: 'chores',
      content: {
        items: [
          { text: 'Make your bed every morning', assignee: null },
          { text: 'Put clean laundry away', assignee: null },
          { text: 'Rinse your dishes after meals', assignee: null },
          { text: 'Clean your room once this week', assignee: null },
        ],
      },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'coaching',
      content: hasEdition && edition.sections.coaching
        ? { generated: true, content: edition.sections.coaching }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'fun_zone',
      content: hasEdition && edition.sections.fun_zone
        ? { generated: true, content: edition.sections.fun_zone }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'brain_fuel',
      content: hasEdition && edition.sections.brain_fuel
        ? { generated: true, content: edition.sections.brain_fuel }
        : { generated: false, content: { title: '', body: '' } },
      enabled: true,
      overridden: false,
    },
    {
      section_type: 'custom' as SectionType,
      content: { generated: false, content: { title: customTitle ?? 'Custom', body: '' } },
      enabled: true,
      overridden: false,
    },
  ]

  return allSections.filter(s => enabledSections.includes(s.section_type))
}

// Server-side functions that use Supabase
export async function getOrCreateCurrentPaper(userId: string): Promise<Paper> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const weekStart = getCurrentWeekStart()

  const { data: existing } = await supabase
    .from('papers')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single()

  if (existing) return existing as Paper

  const { data: paper, error } = await supabase
    .from('papers')
    .insert({ user_id: userId, week_start: weekStart })
    .select()
    .single()

  if (error) throw error

  const edition = await getSharedEdition(supabase, weekStart)

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('enabled_sections, custom_section_title')
    .eq('id', userId)
    .single()

  const sections = getDefaultSections(
    edition,
    userProfile?.enabled_sections ?? ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'],
    userProfile?.custom_section_title,
  ).map(s => ({
    ...s,
    paper_id: paper.id,
  }))

  await supabase.from('paper_sections').insert(sections)

  // Return immediately — AI generation happens async via /api/generate-paper
  return paper as Paper
}

export async function getPaperWithSections(paperId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .single()

  const { data: sections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)
    .order('section_type')

  return { paper, sections: sections ?? [] }
}
