import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { composeNewsletter } from '@/lib/ai/compose'
import { generatePDF } from '@/lib/pdf'
import { sendFinalEmail } from '@/lib/email'
import { getCurrentWeekStart } from '@/lib/papers'

export const maxDuration = 300

function isTargetHour(timezone: string, dayOfWeek: number, hour: number): boolean {
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

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles } = await supabase.from('profiles').select('*')

  let processed = 0

  for (const profile of profiles ?? []) {
    // Check if it's Sunday 8 AM in the user's timezone
    if (!isTargetHour(profile.timezone ?? 'America/New_York', 0, 8)) {
      continue
    }

    try {
      const weekStart = getCurrentWeekStart()

      const { data: paper } = await supabase
        .from('papers')
        .select('*')
        .eq('user_id', profile.id)
        .eq('week_start', weekStart)
        .single()

      if (!paper) {
        console.warn(`No paper found for user ${profile.id} week ${weekStart}`)
        continue
      }

      const { data: sections } = await supabase
        .from('paper_sections')
        .select('*')
        .eq('paper_id', paper.id)

      // Re-compose HTML for preview (picks up Saturday edits)
      const audience = profile.audience ?? ['kids']
      const html = await composeNewsletter(
        { family_name: profile.family_name, audience },
        sections ?? [],
        weekStart
      )

      const pdfBuffer = await generatePDF(html)

      await supabase
        .from('papers')
        .update({ composed_html: html, status: 'final' })
        .eq('id', paper.id)

      await sendFinalEmail(
        profile.email,
        profile.family_name ?? 'Family',
        pdfBuffer,
        weekStart
      )

      processed++
    } catch (error) {
      console.error(`Error processing delivery for user ${profile.id}:`, error)
    }
  }

  return NextResponse.json({ processed })
}
