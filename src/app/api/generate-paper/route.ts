import { createClient } from '@/lib/supabase/server'
import { generateContent, generateThisWeekContent } from '@/lib/ai/content'
import { composeNewsletter } from '@/lib/ai/compose'
import { injectIntranetBlock } from '@/lib/qr'
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

  // Get audience for content generation
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name, audience, intranet_url')
    .eq('id', user.id)
    .single()

  const audience = profile?.audience ?? ['kids']

  // Check if AI sections are already generated (e.g. pre-populated from shared edition)
  const { data: existingSections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  const aiSectionTypes = ['coaching', 'fun_zone', 'brain_fuel']

  const allAiGenerated = existingSections
    ?.filter((s) => aiSectionTypes.includes(s.section_type))
    .every((s) => (s.content as Record<string, unknown>)?.generated === true) ?? false

  const thisWeekPopulated = existingSections?.some(
    (s) => s.section_type === 'this_week' &&
      Array.isArray((s.content as Record<string, unknown>)?.items) &&
      ((s.content as Record<string, unknown>).items as Array<unknown>).length > 0
  ) ?? false

  const fromSharedEdition = allAiGenerated && thisWeekPopulated

  // If paper already has composed HTML and all content is generated, return early
  if (allAiGenerated && paper.composed_html) {
    return NextResponse.json({ sections: existingSections, html: paper.composed_html, status: 'ready' })
  }

  // Generate AI content for sections that need it
  if (!allAiGenerated) {
    const sectionsToGenerate = existingSections?.filter(
      (s) => aiSectionTypes.includes(s.section_type) &&
        (s.content as Record<string, unknown>)?.generated !== true
    ) ?? []

    const contentPromises: Promise<void>[] = []

    for (const section of sectionsToGenerate) {
      contentPromises.push(
        generateContent(section.section_type, audience).then(async (content) => {
          await supabase
            .from('paper_sections')
            .update({ content: { generated: true, content } })
            .eq('id', section.id)
        })
      )
    }

    if (!thisWeekPopulated) {
      const thisWeekSection = existingSections?.find(
        (s) => s.section_type === 'this_week'
      )
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
    }

    await Promise.all(contentPromises)
  }

  // Fetch final sections (may have been updated by AI generation above)
  const { data: allSections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  // Compose the full HTML newsletter (always runs — uses user's family name)
  // Skip vision QA loop when content is from shared edition (already QA'd)
  let html = await composeNewsletter(
    { family_name: profile?.family_name ?? null, audience },
    allSections ?? [],
    paper.week_start,
    undefined,
    { reviewLayout: !fromSharedEdition }
  )

  if (profile?.intranet_url) {
    html = await injectIntranetBlock(html, profile.intranet_url)
  }

  await supabase
    .from('papers')
    .update({ composed_html: html })
    .eq('id', paperId)

  return NextResponse.json({ sections: allSections ?? [], html, status: 'ready' })
}
