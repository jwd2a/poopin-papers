'use client'

import { useState, useRef, useEffect } from 'react'

type ChatEntry = {
  type: 'user' | 'system'
  text: string
}

export function ChatSidebar({
  paperId,
  onUpdate,
}: {
  paperId: string
  onUpdate: () => void
}) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<ChatEntry[]>([])
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function send(text?: string) {
    const message = text || input.trim()
    if (!message || sending) return

    setHistory(prev => [...prev, { type: 'user', text: message }])
    setInput('')
    setSending(true)
    setExpanded(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, paperId }),
      })

      const data = await res.json()
      setHistory(prev => [...prev, { type: 'system', text: data.confirmation }])

      if (data.hasUpdates) {
        onUpdate()
      }
    } catch {
      setHistory(prev => [...prev, { type: 'system', text: 'Something went wrong. Try again?' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div
        className="rounded-2xl border border-stone-200 bg-white/95 backdrop-blur-md"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}
      >
        {/* Chat history (expandable) */}
        {expanded && history.length > 0 && (
          <div className="max-h-48 overflow-y-auto px-4 pt-3 pb-1 space-y-2 border-b border-stone-100">
            {history.map((entry, i) => (
              <div
                key={i}
                className={`text-sm ${
                  entry.type === 'user'
                    ? 'text-stone-600'
                    : 'text-amber-700 font-medium'
                }`}
              >
                {entry.type === 'user' ? '> ' : ''}{entry.text}
              </div>
            ))}
            {sending && (
              <div className="text-sm text-stone-400 animate-pulse">
                Updating your paper...
              </div>
            )}
            <div ref={historyEndRef} />
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-center gap-2 px-4 py-3"
        >
          {expanded && history.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="shrink-0 text-stone-400 hover:text-stone-600 text-xs"
              title="Collapse history"
            >
              ▼
            </button>
          )}
          {!expanded && history.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="shrink-0 text-stone-400 hover:text-stone-600 text-xs"
              title="Show history"
            >
              ▲
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Make a change to this week's paper..."
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-stone-800 placeholder-stone-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-lg bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
