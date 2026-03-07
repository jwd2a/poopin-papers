import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const weekStart = body.weekStart ?? getNextSunday()

  // Check if edition already exists for this week
  const { data: existing } = await supabase
    .from('weekly_editions')
    .select('*')
    .eq('week_start', weekStart)
    .single()

  // Generate new content
  const { sections, composed_html } = await generateSharedEdition(weekStart)

  let edition

  if (existing) {
    // Regenerate: delete old and insert new with same issue_number
    await supabase
      .from('weekly_editions')
      .delete()
      .eq('id', existing.id)

    const { data, error } = await supabase
      .from('weekly_editions')
      .insert({
        week_start: weekStart,
        sections,
        composed_html,
        issue_number: existing.issue_number,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    edition = data
  } else {
    // New edition: determine next issue_number
    const { data: latest } = await supabase
      .from('weekly_editions')
      .select('issue_number')
      .order('issue_number', { ascending: false })
      .limit(1)
      .single()

    const nextIssueNumber = (latest?.issue_number ?? 0) + 1

    const { data, error } = await supabase
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
