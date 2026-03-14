import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { composeNewsletter } from '@/lib/ai/compose'
import { sendPreviewEmail, sendEditionReviewEmail } from '@/lib/email'
import { getUpcomingWeekStart, getDefaultSections, getSharedEdition } from '@/lib/papers'

export const maxDuration = 300

function isTargetHour(timezone: string, dayOfWeek: number, hour: number): boolean {
  // Skip timezone/day check in local dev for testing
  if (process.env.NODE_ENV === 'development') return true

  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    })
    const parts = formatter.formatToParts(now)
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '-1', 10)
    const currentDay = parts.find(p => p.type === 'weekday')?.value

    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }

    return dayMap[currentDay ?? ''] === dayOfWeek && currentHour === hour
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === '1'

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if the edition has been approved by an admin
  const weekStart = getUpcomingWeekStart()
  const { data: edition } = await supabase
    .from('weekly_editions')
    .select('id, status, issue_number')
    .eq('week_start', weekStart)
    .single()

  if (!edition) {
    console.log(`[saturday-preview] No edition found for ${weekStart}, skipping`)
    return NextResponse.json({ skipped: true, reason: 'no_edition' })
  }

  if (edition.status === 'draft') {
    // Edition hasn't been approved yet — nudge admin instead of sending to users
    console.log(`[saturday-preview] Edition ${edition.id} is still draft — sending admin reminder`)
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('is_admin', true)

    for (const admin of admins ?? []) {
      try {
        await sendEditionReviewEmail(admin.email, edition.id, weekStart, edition.issue_number)
      } catch (err) {
        console.error(`[saturday-preview] Failed to remind ${admin.email}:`, err)
      }
    }

    return NextResponse.json({ skipped: true, reason: 'not_approved', reminded_admins: (admins ?? []).length })
  }

  if (edition.status !== 'approved') {
    console.log(`[saturday-preview] Edition ${edition.id} has status "${edition.status}", skipping`)
    return NextResponse.json({ skipped: true, reason: `status_${edition.status}` })
  }

  console.log(`[saturday-preview] Edition ${edition.id} is approved, sending previews`)

  const { data: profiles } = await supabase.from('profiles').select('*')

  let processed = 0

  for (const profile of profiles ?? []) {
    // Check if it's Saturday 8 AM in the user's timezone (skip check if force=1)
    if (!force && !isTargetHour(profile.timezone ?? 'America/New_York', 6, 10)) {
      continue
    }

    try {
      const weekStart = getUpcomingWeekStart()

      // Get or create paper for this week
      let { data: paper } = await supabase
        .from('papers')
        .select('*')
        .eq('user_id', profile.id)
        .eq('week_start', weekStart)
        .single()

      if (!paper) {
        const { data: newPaper, error: insertError } = await supabase
          .from('papers')
          .insert({ user_id: profile.id, week_start: weekStart })
          .select()
          .single()

        if (insertError) throw insertError
        paper = newPaper

        // Insert default sections (populated from shared edition if available)
        const edition = await getSharedEdition(supabase, weekStart)
        const sections = getDefaultSections(
          edition,
          profile.enabled_sections ?? ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'],
          profile.custom_section_title,
        ).map(s => ({
          ...s,
          paper_id: paper!.id,
        }))
        await supabase.from('paper_sections').insert(sections)
      }

      // Get sections
      const { data: sections } = await supabase
        .from('paper_sections')
        .select('*')
        .eq('paper_id', paper.id)

      // Refresh non-overridden sections from shared edition
      const edition = await getSharedEdition(supabase, weekStart)

      if (edition) {
        const sectionMap: Record<string, any> = {
          coaching: edition.sections.coaching ? { generated: true, content: edition.sections.coaching } : null,
          fun_zone: edition.sections.fun_zone ? { generated: true, content: edition.sections.fun_zone } : null,
          brain_fuel: edition.sections.brain_fuel ? { generated: true, content: edition.sections.brain_fuel } : null,
          this_week: edition.sections.this_week ? { items: edition.sections.this_week.items } : null,
        }

        for (const section of sections ?? []) {
          if (section.overridden) continue
          const newContent = sectionMap[section.section_type]
          if (!newContent) continue

          await supabase
            .from('paper_sections')
            .update({ content: newContent })
            .eq('id', section.id)
        }
      }

      // Refetch sections after refresh
      const { data: updatedSections } = await supabase
        .from('paper_sections')
        .select('*')
        .eq('paper_id', paper.id)

      const audience = profile.audience ?? ['kids']

      // Compose newsletter
      const html = await composeNewsletter(
        { family_name: profile.family_name, audience },
        updatedSections ?? [],
        weekStart
      )

      await supabase
        .from('papers')
        .update({ composed_html: html, status: 'preview' })
        .eq('id', paper.id)

      // Send preview email (non-fatal if it fails)
      try {
        const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${paper.id}`
        await sendPreviewEmail(
          profile.email,
          profile.family_name ?? 'Family',
          previewUrl
        )
      } catch (emailError) {
        console.error(`Failed to send preview email for user ${profile.id}:`, emailError)
      }

      processed++
    } catch (error) {
      console.error(`Error processing preview for user ${profile.id}:`, error)
    }
  }

  // Mark edition as published after distribution (only from approved)
  if (processed > 0) {
    await supabase
      .from('weekly_editions')
      .update({ status: 'published' })
      .eq('week_start', weekStart)
      .eq('status', 'approved')
  }

  return NextResponse.json({ processed })
}
