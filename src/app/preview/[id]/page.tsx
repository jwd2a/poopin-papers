import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PreviewToolbar } from './PreviewToolbar'
import { ComposeButton } from './ComposeButton'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: paper } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!paper) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-stone-100">
      <PreviewToolbar paperId={paper.id} />
      <div className="max-w-[8.5in] mx-auto my-8 bg-white shadow-lg">
        {paper.composed_html ? (
          <iframe
            srcDoc={paper.composed_html}
            className="w-full h-[11in] border-0"
            title="Newsletter Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-[11in]">
            <ComposeButton paperId={paper.id} />
          </div>
        )}
      </div>
    </div>
  )
}
