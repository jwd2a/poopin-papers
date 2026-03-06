import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { composeNewsletter } from '@/lib/ai/compose'
import { generateContent } from '@/lib/ai/content'
import { sendPreviewEmail } from '@/lib/email'
import { getCurrentWeekStart, getDefaultSections } from '@/lib/papers'

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
    // Check if it's Saturday 8 AM in the user's timezone
    if (!isTargetHour(profile.timezone ?? 'America/New_York', 6, 8)) {
      continue
    }

    try {
      const weekStart = getCurrentWeekStart()

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

        // Insert default sections
        const sections = getDefaultSections().map(s => ({
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

      // Auto-generate AI content for empty AI sections
      const aiSectionTypes = ['coaching', 'fun_zone', 'brain_fuel']

      const { data: members } = await supabase
        .from('household_members')
        .select('age')
        .eq('user_id', profile.id)

      const ages = (members ?? [])
        .map((m: { age: number | null }) => m.age)
        .filter((a): a is number => a !== null)

      for (const section of (sections ?? []).filter(
        s => aiSectionTypes.includes(s.section_type) && !s.content?.generated
      )) {
        const content = await generateContent(section.section_type, ages)
        await supabase
          .from('paper_sections')
          .update({ content: { generated: true, content } })
          .eq('id', section.id)
      }

      // Refetch sections after AI generation
      const { data: updatedSections } = await supabase
        .from('paper_sections')
        .select('*')
        .eq('paper_id', paper.id)

      // Compose newsletter
      const html = await composeNewsletter(
        { family_name: profile.family_name },
        updatedSections ?? [],
        weekStart
      )

      await supabase
        .from('papers')
        .update({ composed_html: html, status: 'preview' })
        .eq('id', paper.id)

      // Send preview email
      const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${paper.id}`
      await sendPreviewEmail(
        profile.email,
        profile.family_name ?? 'Family',
        previewUrl
      )

      processed++
    } catch (error) {
      console.error(`Error processing preview for user ${profile.id}:`, error)
    }
  }

  return NextResponse.json({ processed })
}
