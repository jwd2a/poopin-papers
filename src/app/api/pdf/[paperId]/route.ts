import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { NewsletterDocument } from '@/lib/pdf/newsletter-document'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'

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
    .select('week_start')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  const { data: sections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name')
    .eq('id', user.id)
    .single()

  const doc = React.createElement(NewsletterDocument, {
    familyName: profile?.family_name ?? 'Family',
    weekStart: paper.week_start,
    sections: sections ?? [],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="poopin-papers-${paper.week_start}.pdf"`,
    },
  })
}

export const maxDuration = 30
