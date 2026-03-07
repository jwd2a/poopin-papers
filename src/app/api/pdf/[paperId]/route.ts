import { createClient } from '@/lib/supabase/server'
import { composeNewsletter } from '@/lib/ai/compose'
import { generatePDF } from '@/lib/pdf'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: paper } = await supabase
    .from('papers')
    .select('week_start, composed_html')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  let html = paper.composed_html

  // If no composed HTML yet, compose it now
  if (!html) {
    const { data: sections } = await supabase
      .from('paper_sections')
      .select('*')
      .eq('paper_id', paperId)

    const { data: profile } = await supabase
      .from('profiles')
      .select('family_name, audience')
      .eq('id', user.id)
      .single()

    html = await composeNewsletter(
      { family_name: profile?.family_name ?? null, audience: profile?.audience ?? ['kids'] },
      sections ?? [],
      paper.week_start
    )

    await supabase
      .from('papers')
      .update({ composed_html: html })
      .eq('id', paperId)
  }

  const pdfBuffer = await generatePDF(html)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="poopin-papers-${paper.week_start}.pdf"`,
    },
  })
}

export const maxDuration = 30
