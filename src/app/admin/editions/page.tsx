import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import type { WeeklyEdition } from '@/lib/types/database'
import Link from 'next/link'
import { GenerateButton } from '@/components/admin/GenerateButton'

function statusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Draft</span>
    case 'approved':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Approved</span>
    case 'published':
      return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Published</span>
    default:
      return null
  }
}

export default async function AdminEditionsPage() {
  if (!(await isAdmin())) redirect('/login')

  const supabase = await createClient()
  const { data: editions, error } = await supabase
    .from('weekly_editions')
    .select('*')
    .order('week_start', { ascending: false })

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <p className="text-red-600">Error loading editions: {error.message}</p>
      </div>
    )
  }

  const typedEditions = (editions ?? []) as WeeklyEdition[]
  const hasDrafts = typedEditions.some(e => e.status === 'draft')

  function sectionCount(edition: WeeklyEdition): number {
    if (!edition.sections) return 0
    return Object.values(edition.sections).filter(Boolean).length
  }

  function htmlSize(edition: WeeklyEdition): string {
    if (!edition.composed_html) return '--'
    const bytes = new TextEncoder().encode(edition.composed_html).length
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Weekly Editions</h1>
        <GenerateButton />
      </div>

      {hasDrafts && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Needs Review:</strong> There are draft editions awaiting your approval.
        </div>
      )}

      {typedEditions.length === 0 ? (
        <p className="text-gray-500">No editions yet. Generate the first one.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left text-sm text-gray-600">
              <th className="py-2 pr-4">Week</th>
              <th className="py-2 pr-4">Issue #</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Sections</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">HTML Size</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {typedEditions.map((edition) => (
              <tr key={edition.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-4 font-mono text-sm">{edition.week_start}</td>
                <td className="py-3 pr-4">{edition.issue_number}</td>
                <td className="py-3 pr-4">{statusBadge(edition.status)}</td>
                <td className="py-3 pr-4">{sectionCount(edition)}</td>
                <td className="py-3 pr-4 font-mono text-sm text-gray-500">
                  {new Date(edition.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4 font-mono text-sm text-gray-500">
                  {htmlSize(edition)}
                </td>
                <td className="py-3">
                  <Link
                    href={`/admin/editions/${edition.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
