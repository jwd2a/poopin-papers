import { requireAdmin } from '@/lib/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const { data: editions, error } = await supabase
    .from('weekly_editions')
    .select('*')
    .order('week_start', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(editions)
}
