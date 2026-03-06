import { createClient } from '@/lib/supabase/server'
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
    .select('composed_html, week_start')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper || !paper.composed_html) {
    return NextResponse.json({ error: 'Paper not composed yet' }, { status: 404 })
  }

  const pdf = await generatePDF(paper.composed_html)

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="poopin-papers-${paper.week_start}.pdf"`,
    },
  })
}

export const maxDuration = 30
