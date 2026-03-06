'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ComposeButton({ paperId }: { paperId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCompose() {
    setLoading(true)
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId }),
      })
      if (!res.ok) {
        throw new Error('Failed to compose')
      }
      router.refresh()
    } catch {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-stone-300 border-t-stone-900 rounded-full mx-auto mb-4" />
        <p className="text-lg font-semibold text-stone-900">Composing your paper...</p>
        <p className="text-sm text-stone-500 mt-1">
          Our AI art director is crafting this week&apos;s edition...
        </p>
      </div>
    )
  }

  return (
    <button
      onClick={handleCompose}
      className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-lg font-semibold transition-colors"
    >
      Compose My Paper
    </button>
  )
}
