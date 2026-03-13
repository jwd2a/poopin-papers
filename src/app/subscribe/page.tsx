'use client'

import { useState } from 'react'

export default function SubscribePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Something went wrong')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f3] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="text-4xl mb-4">🧻📰</div>
        <h1 className="font-[var(--font-playfair)] text-3xl font-bold text-stone-800 mb-2">
          Loved your first issue?
        </h1>
        <p className="text-sm text-stone-500 mb-8">
          Get a fresh family newspaper every single week.
        </p>

        <div className="rounded-xl border-2 border-stone-300 p-6 mb-6" style={{ background: '#f3f1ea' }}>
          <p className="text-4xl font-bold text-stone-800 mb-1">$5</p>
          <p className="text-stone-600 text-sm">per month</p>

          <ul className="mt-4 space-y-2 text-left text-sm text-stone-700">
            <li className="flex items-start gap-2">
              <span className="text-stone-800 font-bold">&#10003;</span>
              Weekly AI-generated family newsletter
            </li>
            <li className="flex items-start gap-2">
              <span className="text-stone-800 font-bold">&#10003;</span>
              Meal plans, chores, coaching &amp; more
            </li>
            <li className="flex items-start gap-2">
              <span className="text-stone-800 font-bold">&#10003;</span>
              Printable PDF delivered to your inbox
            </li>
            <li className="flex items-start gap-2">
              <span className="text-stone-800 font-bold">&#10003;</span>
              Customize sections for your family
            </li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full rounded-full bg-stone-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? 'Redirecting to checkout...' : 'Subscribe Now'}
        </button>

        <p className="mt-4 text-xs text-stone-400">
          Cancel anytime. Powered by Stripe.
        </p>
      </div>
    </div>
  )
}
