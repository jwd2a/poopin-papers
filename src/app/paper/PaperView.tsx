'use client'

import { useState, useRef, useCallback } from 'react'
import { ChatSidebar } from './ChatSidebar'

export function PaperView({
  paperId,
  initialHtml,
}: {
  paperId: string
  initialHtml: string | null
}) {
  const [html, setHtml] = useState(initialHtml)
  const [composing, setComposing] = useState(false)
  const composeTimer = useRef<NodeJS.Timeout | null>(null)

  const triggerRecompose = useCallback(() => {
    // Debounce: wait 2 seconds after last update before recomposing
    if (composeTimer.current) clearTimeout(composeTimer.current)

    composeTimer.current = setTimeout(async () => {
      setComposing(true)
      try {
        const res = await fetch('/api/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId }),
        })
        const data = await res.json()
        if (data.html) setHtml(data.html)
      } finally {
        setComposing(false)
      }
    }, 2000)
  }, [paperId])

  return (
    <div className="flex h-full">
      {/* Newsletter preview */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto" style={{ maxWidth: '8.5in' }}>
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              {composing && (
                <span className="text-sm text-amber-600 animate-pulse">
                  Recomposing your paper...
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/pdf/${paperId}`}
                target="_blank"
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
              >
                Download PDF
              </a>
              <button
                onClick={() => {
                  const iframe = document.querySelector('iframe')
                  iframe?.contentWindow?.print()
                }}
                className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
              >
                Print
              </button>
            </div>
          </div>

          {/* Newsletter */}
          {html ? (
            <div className="bg-white shadow-lg">
              <iframe
                srcDoc={html}
                className="w-full border-0"
                style={{ height: '11in' }}
                title="Your Poopin' Papers"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center bg-white shadow-lg" style={{ height: '11in' }}>
              <div className="text-center">
                <p className="text-stone-500 text-lg font-serif">
                  Composing your first issue...
                </p>
                <p className="text-stone-400 text-sm mt-2">
                  This takes about 15 seconds
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat sidebar */}
      <div className="w-96 border-l border-stone-200 bg-white">
        <ChatSidebar paperId={paperId} onUpdate={triggerRecompose} />
      </div>
    </div>
  )
}
