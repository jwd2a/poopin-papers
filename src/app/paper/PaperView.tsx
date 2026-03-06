'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChatSidebar } from './ChatSidebar'

export function PaperView({
  paperId,
  initialHtml,
}: {
  paperId: string
  initialHtml: string | null
}) {
  // Inject padding into the HTML to simulate print margins in the preview
  function withPreviewMargins(rawHtml: string | null): string | null {
    if (!rawHtml) return null
    const marginStyle = '<style>body { padding: 0.5in; box-sizing: border-box; }</style>'
    // Insert before </head> if present, otherwise before </html>
    if (rawHtml.includes('</head>')) {
      return rawHtml.replace('</head>', marginStyle + '</head>')
    }
    return marginStyle + rawHtml
  }

  const [html, setHtml] = useState(initialHtml)
  const [composing, setComposing] = useState(false)
  const composeTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (composeTimer.current) clearTimeout(composeTimer.current)
    }
  }, [])

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
        if (!res.ok) return
        const data = await res.json()
        if (data.html) setHtml(data.html)
      } finally {
        setComposing(false)
      }
    }, 2000)
  }, [paperId])

  return (
    <div className="flex h-full">
      {/* Newsletter preview — paper on a canvas */}
      <div className="flex-1 overflow-auto bg-stone-300/50 p-8">
        {/* Toolbar */}
        <div className="mx-auto mb-4 flex items-center justify-between" style={{ maxWidth: '8.5in' }}>
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

        {/* Paper sheet */}
        <div
          className="mx-auto bg-white rounded-sm"
          style={{
            maxWidth: '8.5in',
            minHeight: '11in',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          {html ? (
            <iframe
              srcDoc={withPreviewMargins(html) ?? undefined}
              className="w-full border-0 rounded-sm"
              style={{ minHeight: '11in' }}
              scrolling="no"
              title="Your Poopin' Papers"
              onLoad={(e) => {
                const iframe = e.currentTarget
                const doc = iframe.contentDocument
                if (doc?.body) {
                  iframe.style.height = doc.body.scrollHeight + 'px'
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center" style={{ height: '11in' }}>
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

        {/* Bottom breathing room */}
        <div className="h-8" />
      </div>

      {/* Chat sidebar */}
      <div className="w-96 border-l border-stone-200 bg-white">
        <ChatSidebar paperId={paperId} onUpdate={triggerRecompose} />
      </div>
    </div>
  )
}
