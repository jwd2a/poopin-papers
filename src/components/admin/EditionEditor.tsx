'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WeeklyEdition } from '@/lib/types/database'

type ContentSection = { title: string; body: string }
type ThisWeekItem = { text: string; icon?: string }

export function EditionEditor({ edition: initial }: { edition: WeeklyEdition }) {
  const router = useRouter()
  const [edition, setEdition] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const sections = edition.sections ?? {}

  // Section helpers
  function getContentSection(key: 'coaching' | 'fun_zone' | 'brain_fuel'): ContentSection {
    return sections[key] ?? { title: '', body: '' }
  }

  function getThisWeekItems(): ThisWeekItem[] {
    return sections.this_week?.items ?? []
  }

  function updateContentSection(key: 'coaching' | 'fun_zone' | 'brain_fuel', field: 'title' | 'body', value: string) {
    const current = getContentSection(key)
    setEdition({
      ...edition,
      sections: {
        ...sections,
        [key]: { ...current, [field]: value },
      },
    })
  }

  function updateThisWeekItem(index: number, field: 'text' | 'icon', value: string) {
    const items = [...getThisWeekItems()]
    items[index] = { ...items[index], [field]: value }
    setEdition({
      ...edition,
      sections: {
        ...sections,
        this_week: { items },
      },
    })
  }

  function addThisWeekItem() {
    const items = [...getThisWeekItems(), { text: '' }]
    setEdition({
      ...edition,
      sections: {
        ...sections,
        this_week: { items },
      },
    })
  }

  function removeThisWeekItem(index: number) {
    const items = getThisWeekItems().filter((_, i) => i !== index)
    setEdition({
      ...edition,
      sections: {
        ...sections,
        this_week: { items },
      },
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/editions/${edition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: edition.sections }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`Save failed: ${data.error ?? 'Unknown error'}`)
        return
      }
      const updated = await res.json()
      setEdition(updated)
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerate() {
    if (!confirm('Regenerate this edition? All current content will be replaced with new AI-generated content.')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/admin/editions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: edition.week_start }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`Regenerate failed: ${data.error ?? 'Unknown error'}`)
        return
      }
      const updated = await res.json()
      setEdition(updated)
      router.refresh()
    } catch (err) {
      alert(`Regenerate failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRegenerating(false)
    }
  }

  const contentSections: { key: 'coaching' | 'fun_zone' | 'brain_fuel'; label: string }[] = [
    { key: 'coaching', label: 'Coaching' },
    { key: 'fun_zone', label: 'Fun Zone' },
    { key: 'brain_fuel', label: 'Brain Fuel' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <Link href="/admin/editions" className="text-blue-600 hover:text-blue-800 text-sm">
          &larr; Back to editions
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Edition #{edition.issue_number}
          </h1>
          <p className="text-gray-500 font-mono text-sm mt-1">
            Week of {edition.week_start}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="border border-gray-300 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || regenerating}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={saving || regenerating}
            className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {showPreview && edition.composed_html && (
        <div className="mb-8 border border-gray-300 rounded overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 border-b border-gray-300">
            HTML Preview
          </div>
          <iframe
            srcDoc={edition.composed_html}
            className="w-full bg-white"
            style={{ height: '600px' }}
            title="Edition preview"
          />
        </div>
      )}

      {contentSections.map(({ key, label }) => {
        const section = getContentSection(key)
        return (
          <div key={key} className="mb-6 border border-gray-200 rounded p-4">
            <h2 className="text-lg font-semibold mb-3">{label}</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateContentSection(key, 'title', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                value={section.body}
                onChange={(e) => updateContentSection(key, 'body', e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
        )
      })}

      <div className="mb-6 border border-gray-200 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">This Week</h2>
          <button
            onClick={addThisWeekItem}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            + Add Item
          </button>
        </div>
        {getThisWeekItems().length === 0 && (
          <p className="text-gray-400 text-sm">No items yet.</p>
        )}
        {getThisWeekItems().map((item, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateThisWeekItem(index, 'text', e.target.value)}
              placeholder="Item text"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={item.icon ?? ''}
              onChange={(e) => updateThisWeekItem(index, 'icon', e.target.value)}
              placeholder="Icon (optional)"
              className="w-32 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={() => removeThisWeekItem(index)}
              className="text-red-500 hover:text-red-700 text-sm px-2"
              title="Remove item"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
