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

  // Auto-generate AI content for new papers
  try {
    const { data: members } = await supabase
      .from('household_members')
      .select('age')
      .eq('user_id', userId)

    const ages = (members ?? []).map((m: { age: number | null }) => m.age).filter((a): a is number => a !== null)

    const { data: insertedSections } = await supabase
      .from('paper_sections')
      .select('id, section_type')
      .eq('paper_id', paper.id)
      .in('section_type', ['coaching', 'fun_zone', 'brain_fuel'])

    const { generateContent, generateThisWeekContent } = await import('@/lib/ai/content')

    // Generate all AI content in parallel
    const contentPromises: Promise<void>[] = []

    if (insertedSections) {
      for (const section of insertedSections) {
        contentPromises.push(
          generateContent(section.section_type, ages).then(async (content) => {
            await supabase
              .from('paper_sections')
              .update({ content: { generated: true, content } })
              .eq('id', section.id)
          })
        )
      }
    }

    // Generate "This Week" items in parallel with the others
    const { data: thisWeekSection } = await supabase
      .from('paper_sections')
      .select('id')
      .eq('paper_id', paper.id)
      .eq('section_type', 'this_week')
      .single()

    if (thisWeekSection) {
      contentPromises.push(
        generateThisWeekContent().then(async (thisWeekContent) => {
          await supabase
            .from('paper_sections')
            .update({ content: thisWeekContent })
            .eq('id', thisWeekSection.id)
        })
      )
    }

    await Promise.all(contentPromises)

    // Auto-compose the newsletter (must run after all content is generated)
    const { composeNewsletter } = await import('@/lib/ai/compose')
    const { data: allSections } = await supabase
      .from('paper_sections')
      .select('*')
      .eq('paper_id', paper.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('family_name')
      .eq('id', userId)
      .single()

    if (allSections) {
      const html = await composeNewsletter(
        { family_name: profile?.family_name ?? null },
        allSections,
        weekStart
      )
      await supabase
        .from('papers')
        .update({ composed_html: html, status: 'preview' })
        .eq('id', paper.id)

      const { data: updatedPaper } = await supabase
        .from('papers')
        .select('*')
        .eq('id', paper.id)
        .single()

      if (updatedPaper) return updatedPaper as Paper
    }
  } catch (err) {
    console.error('Auto-generation failed, cleaning up:', err)
    await supabase.from('paper_sections').delete().eq('paper_id', paper.id)
    await supabase.from('papers').delete().eq('id', paper.id)
    throw err
  }

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
