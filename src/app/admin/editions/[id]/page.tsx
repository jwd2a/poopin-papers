import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import type { WeeklyEdition } from '@/lib/types/database'
import { notFound } from 'next/navigation'
import { EditionEditor } from '@/components/admin/EditionEditor'

export default async function AdminEditionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isAdmin())) redirect('/login')

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
