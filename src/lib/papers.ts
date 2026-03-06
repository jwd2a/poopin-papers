import type { Paper, SectionType } from '@/lib/types/database'

export function getCurrentWeekStart(now: Date = new Date()): string {
  const date = new Date(now)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  return date.toISOString().split('T')[0]
}

export function getDefaultSections(): Array<{
  section_type: SectionType
  content: Record<string, unknown>
  enabled: boolean
}> {
  return [
    {
      section_type: 'this_week',
      content: { items: [] },
      enabled: true,
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
      enabled: true,
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
    },
    {
      section_type: 'coaching',
      content: { generated: false, content: { title: '', body: '' } },
      enabled: true,
    },
    {
      section_type: 'fun_zone',
      content: { generated: false, content: { title: '', body: '' } },
      enabled: true,
    },
    {
      section_type: 'brain_fuel',
      content: { generated: false, content: { title: '', body: '' } },
      enabled: true,
    },
  ]
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

  const sections = getDefaultSections().map(s => ({
    ...s,
    paper_id: paper.id,
  }))

  await supabase.from('paper_sections').insert(sections)

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
