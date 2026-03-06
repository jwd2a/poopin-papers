'use client'

import { useState, useRef, useEffect } from 'react'

type ChatEntry = {
  type: 'user' | 'system'
  text: string
}

const PRESETS = [
  { label: 'Meal', hint: 'e.g., Tacos for Wednesday dinner' },
  { label: 'Event', hint: "e.g., Soccer practice Tuesday at 5" },
  { label: 'Chore', hint: 'e.g., Feed the dog — Miles' },
  { label: 'Custom', hint: 'Anything you want to add or change' },
]

export function ChatSidebar({
  paperId,
  onUpdate,
}: {
  paperId: string
  onUpdate: () => void
}) {
  const [input, setInput] = useState('')
  const [placeholder, setPlaceholder] = useState('Add something to this week\'s paper...')
  const [history, setHistory] = useState<ChatEntry[]>([])
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  function selectPreset(preset: typeof PRESETS[number]) {
    setPlaceholder(preset.hint)
    setInput('')
    inputRef.current?.focus()
  }

  async function send(text?: string) {
    const message = text || input.trim()
    if (!message || sending) return

    setHistory(prev => [...prev, { type: 'user', text: message }])
    setInput('')
    setSending(true)

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
      setPlaceholder('Add something to this week\'s paper...')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="font-serif text-sm font-semibold text-stone-700">
          Add something to this week&apos;s paper
        </h2>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {history.length === 0 && (
          <p className="text-sm text-stone-400 italic">
            Type below or pick a quick add to get started.
          </p>
        )}
        {history.map((entry, i) => (
          <div
            key={i}
            className={`text-sm ${
              entry.type === 'user'
                ? 'text-stone-700'
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

      {/* Quick picks */}
      <div className="border-t border-stone-100 px-4 py-2">
        <div className="flex gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => selectPreset(preset)}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-amber-100 hover:text-amber-700"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-stone-200 px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={sending}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
