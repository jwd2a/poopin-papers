import { createClient } from '@/lib/supabase/server'
import { getCurrentWeekStart } from '@/lib/papers'
import type { SectionType } from '@/lib/types/database'
import { NextResponse } from 'next/server'

/**
 * POST /api/sync-sections
 * Syncs the current week's paper_sections to match the user's enabled_sections profile setting.
 * Adds missing sections, removes disabled ones (unless overridden by user).
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('enabled_sections, custom_section_title')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const enabledSections: SectionType[] = profile.enabled_sections ?? ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores']

  // Find current week's paper
  const weekStart = getCurrentWeekStart()
  const { data: paper } = await supabase
    .from('papers')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  if (!paper) {
    return NextResponse.json({ synced: false, reason: 'no paper this week' })
  }

  // Get existing sections
  const { data: existing } = await supabase
    .from('paper_sections')
    .select('id, section_type, overridden')
    .eq('paper_id', paper.id)

  const existingTypes = new Set((existing ?? []).map(s => s.section_type))

  // Add missing sections
  const toAdd = enabledSections.filter(t => !existingTypes.has(t))
  for (const sectionType of toAdd) {
    const content = sectionType === 'custom'
      ? { generated: false, content: { title: profile.custom_section_title ?? 'Custom', body: '' } }
      : sectionType === 'meal_plan'
        ? { meals: { sunday: { breakfast: '', lunch: '', dinner: '' }, monday: { breakfast: '', lunch: '', dinner: '' }, tuesday: { breakfast: '', lunch: '', dinner: '' }, wednesday: { breakfast: '', lunch: '', dinner: '' }, thursday: { breakfast: '', lunch: '', dinner: '' }, friday: { breakfast: '', lunch: '', dinner: '' }, saturday: { breakfast: '', lunch: '', dinner: '' } } }
        : sectionType === 'chores'
          ? { items: [{ text: 'Make your bed every morning', assignee: null }] }
          : sectionType === 'this_week'
            ? { items: [] }
            : { generated: false, content: { title: '', body: '' } }

    await supabase
      .from('paper_sections')
      .insert({
        paper_id: paper.id,
        section_type: sectionType,
        content,
        enabled: true,
        overridden: false,
      })
  }

  // Remove disabled sections (only if not overridden by user)
  const toRemove = (existing ?? []).filter(
    s => !enabledSections.includes(s.section_type as SectionType) && !s.overridden
  )
  for (const section of toRemove) {
    await supabase
      .from('paper_sections')
      .delete()
      .eq('id', section.id)
  }

  // Invalidate composed HTML so it recomposes with new sections
  await supabase
    .from('papers')
    .update({ composed_html: null })
    .eq('id', paper.id)

  return NextResponse.json({ synced: true, added: toAdd, removed: toRemove.map(s => s.section_type) })
}
