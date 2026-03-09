import { requireAdmin } from '@/lib/admin'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generateSharedEdition } from '@/lib/editions'
import { NextRequest, NextResponse } from 'next/server'

function getNextSunday(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
  const nextSunday = new Date(now)
  nextSunday.setDate(now.getDate() + daysUntilSunday)
  return nextSunday.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  // Service role client for writes (RLS only allows SELECT for authenticated users)
  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await request.json().catch(() => ({}))
  const weekStart = body.weekStart ?? getNextSunday()

  // Check if edition already exists for this week
  const { data: existing } = await db
    .from('weekly_editions')
    .select('*')
    .eq('week_start', weekStart)
    .single()

  // Generate new content
  const { sections, composed_html } = await generateSharedEdition(weekStart, db)

  let edition

  if (existing) {
    // Regenerate: update in place
    const { data, error } = await db
      .from('weekly_editions')
      .update({ sections, composed_html })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    edition = data
  } else {
    // New edition: determine next issue_number
    const { data: latest } = await db
      .from('weekly_editions')
      .select('issue_number')
      .order('issue_number', { ascending: false })
      .limit(1)
      .single()

    const nextIssueNumber = (latest?.issue_number ?? 0) + 1

    const { data, error } = await db
      .from('weekly_editions')
      .insert({
        week_start: weekStart,
        sections,
        composed_html,
        issue_number: nextIssueNumber,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    edition = data
  }

  return NextResponse.json(edition)
}
