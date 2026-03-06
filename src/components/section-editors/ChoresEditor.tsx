'use client'

import { useState, useCallback } from 'react'
import type { PaperSection, ChoresContent, HouseholdMember } from '@/lib/types/database'

type ChoreItem = ChoresContent['items'][number]

function getInitialItems(content: Record<string, unknown>): ChoreItem[] {
  const c = content as ChoresContent
  return c.items ?? []
}

export default function ChoresEditor({
  section,
  members,
}: {
  section: PaperSection
  members: HouseholdMember[]
}) {
  const [items, setItems] = useState<ChoreItem[]>(() => getInitialItems(section.content))

  const save = useCallback(
    async (updated: ChoreItem[]) => {
      await fetch(`/api/papers/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { items: updated } }),
      })
    },
    [section.id]
  )

  function handleChange(index: number, field: keyof ChoreItem, value: string) {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value || null }
      if (field === 'text') updated[index].text = value
      return updated
    })
  }

  function handleBlur() {
    save(items)
  }

  function addItem() {
    const updated = [...items, { text: '', assignee: null }]
    setItems(updated)
  }

  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    save(updated)
  }

  const kidNames = members.filter(m => m.role === 'kid').map(m => m.name)

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item.text}
            onChange={e => handleChange(i, 'text', e.target.value)}
            onBlur={handleBlur}
            placeholder="Chore description..."
            className="flex-1 rounded border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <select
            value={item.assignee ?? ''}
            onChange={e => {
              handleChange(i, 'assignee', e.target.value)
              // Save immediately on select change
              const updated = [...items]
              updated[i] = { ...updated[i], assignee: e.target.value || null }
              save(updated)
            }}
            className="rounded border border-stone-200 px-2 py-2 text-sm text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">Unassigned</option>
            {kidNames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={() => removeItem(i)}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Remove chore"
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
        + Add chore
      </button>
    </div>
  )
}
