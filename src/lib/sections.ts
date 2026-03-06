export async function updateSectionContent(
  sectionId: string,
  content: Record<string, unknown>
) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('paper_sections')
    .update({ content })
    .eq('id', sectionId)

  if (error) throw error
}

export async function toggleSection(sectionId: string, enabled: boolean) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('paper_sections')
    .update({ enabled })
    .eq('id', sectionId)

  if (error) throw error
}
