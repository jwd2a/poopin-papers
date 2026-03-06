import { createClient } from '@/lib/supabase/server'
import { getCurrentWeekStart } from '@/lib/papers'
import { generateContent, generateThisWeekContent } from '@/lib/ai/content'
import { composeNewsletter } from '@/lib/ai/compose'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { paperId } = await request.json()

  // Verify paper ownership
  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  // If already composed, return it
  if (paper.composed_html) {
    return NextResponse.json({ html: paper.composed_html, status: 'ready' })
  }

  // Get audience for content generation
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name, audience')
    .eq('id', user.id)
    .single()

  const audience = profile?.audience ?? ['kids']

  const { data: aiSections } = await supabase
    .from('paper_sections')
    .select('id, section_type')
    .eq('paper_id', paperId)
    .in('section_type', ['coaching', 'fun_zone', 'brain_fuel'])

  const { data: thisWeekSection } = await supabase
    .from('paper_sections')
    .select('id')
    .eq('paper_id', paperId)
    .eq('section_type', 'this_week')
    .single()

  const contentPromises: Promise<void>[] = []

  if (aiSections) {
    for (const section of aiSections) {
      contentPromises.push(
        generateContent(section.section_type, audience).then(async (content) => {
          await supabase
            .from('paper_sections')
            .update({ content: { generated: true, content } })
            .eq('id', section.id)
        })
      )
    }
  }

  if (thisWeekSection) {
    contentPromises.push(
      generateThisWeekContent(audience).then(async (thisWeekContent) => {
        await supabase
          .from('paper_sections')
          .update({ content: thisWeekContent })
          .eq('id', thisWeekSection.id)
      })
    )
  }

  await Promise.all(contentPromises)

  // Compose the newsletter
  const { data: allSections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  const weekStart = getCurrentWeekStart()

  const html = await composeNewsletter(
    { family_name: profile?.family_name ?? null, audience },
    allSections ?? [],
    weekStart
  )

  await supabase
    .from('papers')
    .update({ composed_html: html, status: 'preview' })
    .eq('id', paperId)

  return NextResponse.json({ html, status: 'ready' })
}
