import { createClient } from '@/lib/supabase/server'
import type { WeeklyEdition } from '@/lib/types/database'
import { notFound } from 'next/navigation'
import { EditionEditor } from '@/components/admin/EditionEditor'

export default async function AdminEditionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: edition, error } = await supabase
    .from('weekly_editions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !edition) {
    notFound()
  }

  return <EditionEditor edition={edition as WeeklyEdition} />
}
