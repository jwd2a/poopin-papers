import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { composeNewsletter } from '@/lib/ai/compose'
import { SHARED_AUDIENCE } from '@/lib/editions'
import type { PaperSection, WeeklyEdition } from '@/lib/types/database'
import { NextRequest, NextResponse } from 'next/server'

function mockSection(
  sectionType: string,
  content: Record<string, unknown>
): PaperSection {
  return {
    id: `shared-${sectionType}`,
    paper_id: 'shared-edition',
    section_type: sectionType,
    content,
    enabled: true,
    overridden: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as PaperSection
}

const DEFAULT_CHORES = {
  items: [
    { text: 'Make your bed every morning' },
    { text: 'Put clean laundry away' },
    { text: 'Rinse your dishes after meals' },
    { text: 'Clean your room once this week' },
  ],
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: edition, error } = await supabase
    .from('weekly_editions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(edition)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { sections } = await request.json() as { sections: WeeklyEdition['sections'] }

  // Fetch existing edition to get week_start and issue_number
  const { data: existing, error: fetchError } = await supabase
    .from('weekly_editions')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 404 })
  }

  // Build mock PaperSection array for re-composition (same pattern as generateSharedEdition)
  const paperSections: PaperSection[] = [
    mockSection('coaching', { generated: true, content: sections.coaching }),
    mockSection('fun_zone', { generated: true, content: sections.fun_zone }),
    mockSection('brain_fuel', { generated: true, content: sections.brain_fuel }),
    mockSection('this_week', sections.this_week as unknown as Record<string, unknown>),
    mockSection('chores', DEFAULT_CHORES as unknown as Record<string, unknown>),
  ]

  const composed_html = await composeNewsletter(
    { family_name: 'Our Family', audience: SHARED_AUDIENCE },
    paperSections,
    existing.week_start,
    existing.issue_number,
    { reviewLayout: false }
  )

  // Service role client for writes (RLS only allows SELECT for authenticated users)
  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: updated, error: updateError } = await db
    .from('weekly_editions')
    .update({ sections, composed_html })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
