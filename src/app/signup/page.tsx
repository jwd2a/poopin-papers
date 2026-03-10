'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback?next=/subscribe`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If email confirmation is required, user won't have a session yet
    if (data.user && !data.session) {
      setCheckEmail(true)
      setLoading(false)
      return
    }

    // If no confirmation needed (local dev), set timezone and redirect
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { data: { user: newUser } } = await supabase.auth.getUser()
    if (newUser) {
      await supabase.from('profiles').update({ timezone }).eq('id', newUser.id)
    }

    router.push('/subscribe')
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f3] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-6">
            <h1 className="font-[var(--font-playfair)] text-3xl font-bold text-stone-800">
              Poopin&apos; Papers
            </h1>
          </div>
          <h2 className="mb-4 text-xl font-semibold text-stone-700">
            Check your email
          </h2>
          <p className="text-stone-600">
            We sent a confirmation link to <strong>{email}</strong>.
            Click the link to activate your account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f3] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="font-[var(--font-playfair)] text-3xl font-bold text-stone-800">
            Poopin&apos; Papers
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            A family newspaper, delivered weekly
          </p>
        </div>

        <h2 className="mb-6 text-xl font-semibold text-stone-700">
          Create your account
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-stone-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 placeholder-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-stone-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 placeholder-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-stone-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-stone-700 underline hover:text-stone-900"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
