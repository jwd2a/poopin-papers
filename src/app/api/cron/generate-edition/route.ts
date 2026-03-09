import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generateSharedEdition } from '@/lib/editions'
import { sendEditionReviewEmail } from '@/lib/email'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Calculate next Sunday's date (the week_start for the edition)
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 5 = Friday, 6 = Saturday
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek
  const nextSunday = new Date(now)
  nextSunday.setDate(now.getDate() + daysUntilSunday)
  const weekStart = nextSunday.toISOString().split('T')[0]

  console.log(`[generate-edition] Generating edition for week_start=${weekStart}`)

  // Check if edition already exists for that week
  const { data: existing } = await supabase
    .from('weekly_editions')
    .select('id, issue_number')
    .eq('week_start', weekStart)
    .single()

  if (existing) {
    console.log(`[generate-edition] Edition already exists for ${weekStart} (issue #${existing.issue_number}), skipping`)
    return NextResponse.json({
      skipped: true,
      weekStart,
      issueNumber: existing.issue_number,
    })
  }

  // Get next issue number
  const { data: maxIssue } = await supabase
    .from('weekly_editions')
    .select('issue_number')
    .order('issue_number', { ascending: false })
    .limit(1)
    .single()

  const issueNumber = maxIssue ? maxIssue.issue_number + 1 : 1

  console.log(`[generate-edition] Generating issue #${issueNumber}`)

  // Generate content
  const { sections, composed_html } = await generateSharedEdition(weekStart, supabase)

  console.log(`[generate-edition] Content generated, inserting into weekly_editions`)

  // Insert into weekly_editions
  const { data: inserted, error: insertError } = await supabase
    .from('weekly_editions')
    .insert({
      week_start: weekStart,
      sections,
      composed_html,
      issue_number: issueNumber,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error(`[generate-edition] Insert error:`, insertError)
    return NextResponse.json(
      { error: 'Failed to save edition', details: insertError.message },
      { status: 500 }
    )
  }

  console.log(`[generate-edition] Successfully created edition #${issueNumber} for ${weekStart}`)

  // Notify admins
  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .eq('is_admin', true)

  for (const admin of admins ?? []) {
    try {
      await sendEditionReviewEmail(admin.email, inserted.id, weekStart, issueNumber)
    } catch (err) {
      console.error(`[generate-edition] Failed to notify ${admin.email}:`, err)
    }
  }

  return NextResponse.json({ weekStart, issueNumber })
}
