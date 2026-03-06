import { createClient } from '@/lib/supabase/server'
import { getOrCreateCurrentPaper } from '@/lib/papers'
import { PaperView } from './PaperView'

export default async function PaperPage() {
  // Auth guard is in layout.tsx — user is guaranteed authenticated here
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const paper = await getOrCreateCurrentPaper(user!.id)

  return <PaperView paperId={paper.id} initialHtml={paper.composed_html} />
}
