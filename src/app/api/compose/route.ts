import { createClient } from '@/lib/supabase/server'
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

  const { data: paper } = await supabase
    .from('papers')
    .select('*')
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
    .select('family_name, audience, intranet_url')
    .eq('id', user.id)
    .single()

  let html = await composeNewsletter(
    { family_name: profile?.family_name ?? null, audience: profile?.audience ?? ['kids'] },
    sections ?? [],
    paper.week_start,
    undefined,
    { reviewLayout: false }
  )

  if (profile?.intranet_url) {
    html = await injectIntranetBlock(html, profile.intranet_url)
  }

  await supabase
    .from('papers')
    .update({ composed_html: html, status: 'preview' })
    .eq('id', paperId)

  return NextResponse.json({ html })
}
