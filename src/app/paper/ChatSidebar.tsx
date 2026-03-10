'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const WORKING_MESSAGES = [
  'Working on your edits...',
  'Updating your paper...',
  'Making those changes...',
  'Almost there...',
  'Tweaking the layout...',
  'Polishing things up...',
]

type Phase = 'idle' | 'working' | 'done'

export function ChatSidebar({
  paperId,
  onUpdate,
}: {
  paperId: string
  onUpdate: () => void
}) {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [userMessage, setUserMessage] = useState('')
  const [workingMsg, setWorkingMsg] = useState(WORKING_MESSAGES[0])
  const [dismissing, setDismissing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const workingInterval = useRef<NodeJS.Timeout | null>(null)

  // Rotate working messages
  useEffect(() => {
    if (phase === 'working') {
      let idx = 0
      setWorkingMsg(WORKING_MESSAGES[0])
      workingInterval.current = setInterval(() => {
        idx = (idx + 1) % WORKING_MESSAGES.length
        setWorkingMsg(WORKING_MESSAGES[idx])
      }, 2500)
    }
    return () => {
      if (workingInterval.current) clearInterval(workingInterval.current)
    }
  }, [phase])

  // When API returns, start dismiss animation
  useEffect(() => {
    if (phase !== 'done') return
    setDismissing(true)
    const timer = setTimeout(() => {
      setPhase('idle')
      setUserMessage('')
      setDismissing(false)
      inputRef.current?.focus()
    }, 400)
    return () => clearTimeout(timer)
  }, [phase])

  const send = useCallback(async () => {
    const message = input.trim()
    if (!message || phase !== 'idle') return

    setUserMessage(message)
    setInput('')
    setPhase('working')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, paperId, history: [] }),
      })

      const data = await res.json()
      if (data.hasUpdates) {
        onUpdate()
      }
      setPhase('done')
    } catch {
      setPhase('done')
    }
  }, [input, phase, paperId, onUpdate])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      {/* Bubbles area — shows during working/done phases */}
      {phase !== 'idle' && (
        <div
          className={`mb-3 space-y-2 transition-all duration-400 ${
            dismissing
              ? 'opacity-0 scale-95 translate-y-2'
              : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          {/* User bubble */}
          <div className="flex justify-end animate-[slideUp_0.25s_ease-out]">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-stone-800 px-4 py-2.5 text-sm text-white shadow-md">
              {userMessage}
            </div>
          </div>

          {/* Working indicator */}
          {phase === 'working' && (
            <div className="flex justify-start animate-[slideUp_0.3s_ease-out]">
              <div className="rounded-2xl rounded-bl-md bg-stone-100 px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce"
                        style={{
                          animationDelay: `${i * 0.15}s`,
                          animationDuration: '0.8s',
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-sm text-stone-500 animate-[fadeSwap_0.3s_ease-in-out]"
                    key={workingMsg}
                  >
                    {workingMsg}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      <div
        className="rounded-2xl border border-stone-200 bg-white/95 backdrop-blur-md"
        style={{
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-center gap-2 px-4 py-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Make a change to this week's paper..."
            disabled={phase !== 'idle'}
            className="flex-1 bg-transparent text-sm text-stone-800 placeholder-stone-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={phase !== 'idle' || !input.trim()}
            className="shrink-0 rounded-lg bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
