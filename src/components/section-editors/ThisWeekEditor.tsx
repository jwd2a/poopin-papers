'use client'

import { useState, useCallback } from 'react'
import { pickIcon } from '@/lib/icons'
import type { PaperSection, ThisWeekContent } from '@/lib/types/database'

type ThisWeekItem = ThisWeekContent['items'][number]

function getInitialItems(content: Record<string, unknown>): ThisWeekItem[] {
  const c = content as ThisWeekContent
  return c.items ?? []
}

export default function ThisWeekEditor({
  section,
  onSave,
}: {
  section: PaperSection
  onSave?: (p: Promise<unknown>) => void
}) {
  const [items, setItems] = useState<ThisWeekItem[]>(() => getInitialItems(section.content))

  const save = useCallback(
    (updated: ThisWeekItem[]) => {
      const withIcons = updated.map(item => ({
        ...item,
        icon: item.icon || pickIcon(item.text),
      }))
      const p = fetch(`/api/papers/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { items: withIcons } }),
      })
      onSave?.(p)
    },
    [section.id, onSave]
  )

  function handleChange(index: number, value: string) {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], text: value }
      return updated
    })
  }

  function handleBlur() {
    save(items)
  }

  function addItem() {
    setItems(prev => [...prev, { text: '' }])
  }

  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    save(updated)
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item.text}
            onChange={e => handleChange(i, e.target.value)}
            onBlur={handleBlur}
            placeholder="What's happening this week..."
            className="flex-1 rounded border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button
            onClick={() => removeItem(i)}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Remove item"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-sm font-medium text-amber-700 hover:text-amber-800"
      >
        + Add item
      </button>
    </div>
  )
}
