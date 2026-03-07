'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChatSidebar } from './ChatSidebar'
import type { PaperSection } from '@/lib/types/database'

type Props = {
  paperId: string
  familyName: string
  weekStart: string
  initialSections: PaperSection[]
  initialHtml: string | null
}

export function PaperView({ paperId, familyName, weekStart, initialSections, initialHtml }: Props) {
  const [html, setHtml] = useState(initialHtml)
  const [composing, setComposing] = useState(false)
  const [generating, setGenerating] = useState(
    initialSections.some(
      (s) => ['coaching', 'fun_zone', 'brain_fuel'].includes(s.section_type) &&
        (s.content as Record<string, unknown>).generated === false
    )
  )
  const composeTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (composeTimer.current) clearTimeout(composeTimer.current)
    }
  }, [])

  // Kick off AI content generation + composition if not ready yet
  useEffect(() => {
    if (!generating) return

    let cancelled = false

    async function generate() {
      try {
        const res = await fetch('/api/generate-paper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId }),
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) {
          if (data.html) setHtml(data.html)
          setGenerating(false)
        }
      } catch {
        if (!cancelled) {
          setTimeout(generate, 3000)
        }
      }
    }

    generate()

    return () => { cancelled = true }
  }, [paperId, generating])

  const triggerRecompose = useCallback(() => {
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
    }, 1000)
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
                Updating preview...
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/pdf/${paperId}`}
              download="poopin-papers.pdf"
              className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Download PDF
            </a>
            <a
              href={`/api/pdf/${paperId}`}
              target="_blank"
              className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
            >
              Print
            </a>
          </div>
        </div>

        {/* Paper sheet */}
        <div
          className="mx-auto bg-white rounded-sm relative"
          style={{
            maxWidth: '8.5in',
            minHeight: '11in',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          {/* Composing overlay */}
          {composing && html && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-sm bg-white/80 backdrop-blur-[1px]">
              <div className="text-center">
                <div className="mb-4 text-4xl animate-spin" style={{ animationDuration: '3s' }}>
                  🧻
                </div>
                <p className="text-stone-700 font-serif font-semibold">
                  Updating your paper...
                </p>
                <div className="mt-3 flex justify-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {html ? (
            <iframe
              srcDoc={html}
              className="w-full border-0"
              style={{ height: '11in' }}
              title="Newsletter Preview"
            />
          ) : (
            <div className="flex items-center justify-center" style={{ height: '11in' }}>
              <div className="text-center">
                <div className="mb-6 text-5xl animate-bounce" style={{ animationDuration: '2s' }}>
                  🧻
                </div>
                <p className="text-stone-700 text-xl font-serif font-bold mb-2">
                  Rolling out your first issue...
                </p>
                <p className="text-stone-400 text-sm">
                  Our tiny robots are writing, drawing, and folding
                </p>
                <div className="mt-6 flex justify-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2 w-2 rounded-full bg-amber-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1s' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>

      {/* Chat sidebar */}
      <div className="w-96 border-l border-stone-200 bg-white">
        <ChatSidebar paperId={paperId} onUpdate={triggerRecompose} />
      </div>
    </div>
  )
}
