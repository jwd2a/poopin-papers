import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name')
    .eq('id', user.id)
    .single()

  const familyName = profile?.family_name || 'Family'

  try {
    await sendWelcomeEmail(user.email, familyName)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Failed to send welcome email:', err)
    return NextResponse.json({ ok: true }) // Don't block onboarding
  }
}
