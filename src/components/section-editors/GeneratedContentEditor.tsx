'use client'

import { useState, useCallback } from 'react'
import type { PaperSection, GeneratedContent } from '@/lib/types/database'

function getInitialContent(content: Record<string, unknown>): GeneratedContent {
  const c = content as GeneratedContent
  return {
    generated: c.generated ?? false,
    content: {
      title: c.content?.title ?? '',
      body: c.content?.body ?? '',
    },
  }
}

export default function GeneratedContentEditor({
  section,
  ages,
  onSave,
}: {
  section: PaperSection
  ages: number[]
  onSave?: (p: Promise<unknown>) => void
}) {
  const [data, setData] = useState<GeneratedContent>(() => getInitialContent(section.content))
  const [generating, setGenerating] = useState(false)

  const save = useCallback(
    (updated: GeneratedContent) => {
      const p = fetch(`/api/papers/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: updated }),
      })
      onSave?.(p)
    },
    [section.id, onSave]
  )

  function handleChange(field: 'title' | 'body', value: string) {
    setData(prev => ({
      ...prev,
      content: { ...prev.content, [field]: value },
    }))
  }

  function handleBlur() {
    save(data)
  }

  async function regenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: section.section_type,
          ages,
        }),
      })
      const { content } = await res.json()
      const updated: GeneratedContent = {
        generated: true,
        content: {
          title: content.title ?? '',
          body: content.body ?? '',
        },
      }
      setData(updated)
      await save(updated)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={data.content.title}
        onChange={e => handleChange('title', e.target.value)}
        onBlur={handleBlur}
        placeholder="Title..."
        className="w-full rounded border border-stone-200 px-3 py-2 text-sm font-medium text-stone-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      <textarea
        value={data.content.body}
        onChange={e => handleChange('body', e.target.value)}
        onBlur={handleBlur}
        placeholder="Content..."
        rows={5}
        className="w-full rounded border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      <button
        onClick={regenerate}
        disabled={generating}
        className="rounded bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
      >
        {generating ? 'Generating...' : 'Regenerate with AI'}
      </button>
    </div>
  )
}
