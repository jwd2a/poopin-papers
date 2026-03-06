import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateCurrentPaper } from '@/lib/papers'
import { PaperView } from './PaperView'

export default async function PaperPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const paper = await getOrCreateCurrentPaper(user.id)

  return <PaperView paperId={paper.id} initialHtml={paper.composed_html} />
}
