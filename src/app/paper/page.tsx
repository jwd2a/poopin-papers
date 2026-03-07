import { createClient } from '@/lib/supabase/server'
import { getOrCreateCurrentPaper, getPaperWithSections, getCurrentWeekStart } from '@/lib/papers'
import { PaperView } from './PaperView'

export default async function PaperPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const paper = await getOrCreateCurrentPaper(user!.id)
  const { sections } = await getPaperWithSections(paper.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_name')
    .eq('id', user!.id)
    .single()

  // Fetch composed_html
  const { data: paperData } = await supabase
    .from('papers')
    .select('composed_html')
    .eq('id', paper.id)
    .single()

  return (
    <PaperView
      paperId={paper.id}
      familyName={profile?.family_name ?? 'Family'}
      weekStart={paper.week_start ?? getCurrentWeekStart()}
      initialSections={sections}
      initialHtml={paperData?.composed_html ?? null}
    />
  )
}
