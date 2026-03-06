import { createClient } from '@/lib/supabase/server'
import { generateContent, generateThisWeekContent } from '@/lib/ai/content'
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

  // If already generated, return sections
  const { data: existingSections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  const alreadyGenerated = existingSections?.some(
    (s) => ['coaching', 'fun_zone', 'brain_fuel'].includes(s.section_type) &&
      (s.content as Record<string, unknown>)?.generated === true
  )

  if (alreadyGenerated) {
    return NextResponse.json({ sections: existingSections, status: 'ready' })
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

  // Return updated sections
  const { data: allSections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  return NextResponse.json({ sections: allSections ?? [], status: 'ready' })
}
