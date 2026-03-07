import { createClient } from '@/lib/supabase/server'
import { processChatMessage } from '@/lib/ai/chat'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let message: string, paperId: string
  try {
    const body = await request.json()
    message = body.message
    paperId = body.paperId
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!message?.trim() || !paperId) {
    return NextResponse.json({ error: 'Message and paperId are required' }, { status: 400 })
  }

  // Verify paper ownership
  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .eq('user_id', user.id)
    .single()

  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  // Get current sections
  const { data: sections } = await supabase
    .from('paper_sections')
    .select('*')
    .eq('paper_id', paperId)

  if (!sections) {
    return NextResponse.json({ error: 'No sections found' }, { status: 404 })
  }

  // Process chat message
  let chatResponse
  try {
    chatResponse = await processChatMessage(
      message,
      sections.map(s => ({ section_type: s.section_type, content: s.content as Record<string, unknown> }))
    )
  } catch {
    return NextResponse.json({
      confirmation: 'Sorry, something went wrong processing your message. Try again?',
      hasUpdates: false,
    })
  }

  // Apply updates to sections
  for (const update of chatResponse.updates) {
    const section = sections.find(s => s.section_type === update.section_type)
    if (!section) continue

    let newContent: Record<string, unknown>

    if (update.action === 'replace') {
      newContent = update.data
    } else {
      // Merge: handle arrays (this_week items, chores items) and objects (meal_plan meals)
      const existing = section.content as Record<string, unknown>
      if (update.data.items && Array.isArray(update.data.items)) {
        const existingItems = (existing.items as unknown[]) || []
        newContent = { ...existing, items: [...existingItems, ...update.data.items] }
      } else if (update.data.meals) {
        const existingMeals = (existing.meals as Record<string, unknown>) || {}
        const newMeals = update.data.meals as Record<string, unknown>
        const merged: Record<string, unknown> = { ...existingMeals }
        for (const [day, meals] of Object.entries(newMeals)) {
          merged[day] = { ...(existingMeals[day] as Record<string, unknown> || {}), ...(meals as Record<string, unknown>) }
        }
        newContent = { ...existing, meals: merged }
      } else {
        newContent = { ...existing, ...update.data }
      }
    }

    await supabase
      .from('paper_sections')
      .update({ content: newContent, overridden: true, enabled: true })
      .eq('id', section.id)
  }

  // Return confirmation immediately, compose will be triggered by client
  return NextResponse.json({
    confirmation: chatResponse.confirmation,
    hasUpdates: chatResponse.updates.length > 0,
  })
}
