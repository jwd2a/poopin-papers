import { createClient } from '@/lib/supabase/server'
import { composeNewsletter } from '@/lib/ai/compose'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership: join paper_sections -> papers to check user_id
  const { data: section } = await supabase
    .from('paper_sections')
    .select('id, paper_id, papers!inner(user_id)')
    .eq('id', id)
    .single()

  if (
    !section ||
    (section.papers as unknown as { user_id: string }).user_id !== user.id
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.content !== undefined) {
    updates.content = body.content
    updates.overridden = true
  }
  if (body.enabled !== undefined) {
    updates.enabled = body.enabled
  }

  const { error } = await supabase
    .from('paper_sections')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Recompose the newsletter with updated sections
  const paperId = section.paper_id
  const { data: allSections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  const { data: paper } = await supabase
    .from('papers')
    .select('week_start')
    .eq('id', paperId)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name, audience')
    .eq('id', user.id)
    .single()

  if (allSections && paper && profile) {
    const html = await composeNewsletter(
      { family_name: profile.family_name ?? null, audience: profile.audience ?? ['kids'] },
      allSections,
      paper.week_start,
      undefined,
      { reviewLayout: false }
    )

    await supabase
      .from('papers')
      .update({ composed_html: html })
      .eq('id', paperId)
  }

  return NextResponse.json({ success: true })
}
