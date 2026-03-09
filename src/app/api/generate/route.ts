import { createClient } from '@/lib/supabase/server'
import { generateContent } from '@/lib/ai/content'
import { getPastContentSummary } from '@/lib/content-history'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sectionType, ages } = await request.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('custom_section_prompt')
    .eq('id', user.id)
    .single()

  const customPrompt = sectionType === 'custom'
    ? profile?.custom_section_prompt ?? undefined
    : undefined

  const pastContent = await getPastContentSummary(supabase, [sectionType])
  const content = await generateContent(sectionType, ages ?? [], pastContent, customPrompt)

  return NextResponse.json({ content })
}
