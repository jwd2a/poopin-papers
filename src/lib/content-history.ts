import { SupabaseClient } from '@supabase/supabase-js'

type SectionContent = {
  title?: string
  body?: string
  riddle_answer?: string
  items?: Array<{ text: string }>
}

/**
 * Fetch previously used content from past weekly editions to avoid repeats.
 * Returns a summary string suitable for passing to AI prompts.
 */
export async function getPastContentSummary(
  supabase: SupabaseClient,
  sectionTypes?: string[]
): Promise<string> {
  const { data: editions } = await supabase
    .from('weekly_editions')
    .select('sections, week_start')
    .order('week_start', { ascending: false })
    .limit(12)

  if (!editions?.length) return ''

  const types = sectionTypes ?? ['coaching', 'fun_zone', 'brain_fuel']
  const pastItems: string[] = []

  for (const edition of editions) {
    const sections = edition.sections as Record<string, SectionContent>
    for (const type of types) {
      const s = sections[type]
      if (!s) continue

      if (type === 'brain_fuel') {
        const parts: string[] = []
        if (s.body) parts.push(`Quote/riddle: ${s.body}`)
        if (s.riddle_answer) parts.push(`Answer: ${s.riddle_answer}`)
        if (parts.length) pastItems.push(`[${edition.week_start} brain_fuel] ${parts.join(' | ')}`)
      } else if (type === 'fun_zone') {
        if (s.body) pastItems.push(`[${edition.week_start} fun_zone] ${s.body}`)
      } else if (type === 'coaching') {
        if (s.title) pastItems.push(`[${edition.week_start} coaching] ${s.title}: ${s.body?.slice(0, 80) ?? ''}`)
      }
    }
  }

  if (!pastItems.length) return ''
  return pastItems.join('\n')
}
