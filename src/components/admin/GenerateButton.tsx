'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GenerateButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleGenerate() {
    if (!confirm('Generate a new edition for next week? This may take a moment.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/editions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error ?? 'Unknown error'}`)
        return
      }
      router.refresh()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Generating...' : 'Generate Next Week'}
    </button>
  )
}
