import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCurrentPaper, getPaperWithSections } from '@/lib/papers'
import type { Profile, HouseholdMember, PaperSection } from '@/lib/types/database'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const paper = await getOrCreateCurrentPaper(user.id)
  const { sections } = await getPaperWithSections(paper.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: members } = await supabase
    .from('household_members')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at')

  return (
    <DashboardClient
      paper={paper}
      sections={sections as PaperSection[]}
      profile={profile as Profile}
      members={(members ?? []) as HouseholdMember[]}
    />
  )
}
