'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Audience } from '@/lib/types/database'

interface FamilyMember {
  name: string
  age: string
  role: 'parent' | 'kid'
}

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

const AUDIENCE_OPTIONS: Array<{
  value: Audience
  emoji: string
  label: string
  description: string
}> = [
  {
    value: 'toddlers',
    emoji: '\uD83D\uDC76',
    label: 'Toddlers',
    description: 'Ages 2-4. Simple words, big pictures, lots of fun!',
  },
  {
    value: 'kids',
    emoji: '\uD83E\uDDD2',
    label: 'Kids',
    description: 'Ages 5-9. Jokes, activities, and easy reads.',
  },
  {
    value: 'pre-teens',
    emoji: '\uD83D\uDE0E',
    label: 'Pre-teens',
    description: 'Ages 10-12. A bit more grown up, still playful.',
  },
  {
    value: 'teens',
    emoji: '\uD83C\uDFB8',
    label: 'Teens',
    description: 'Ages 13-17. Witty, relatable, not cringey.',
  },
  {
    value: 'adults',
    emoji: '\u2615',
    label: 'Adults',
    description: 'Grown-up humor and sophisticated tone.',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'audience' | 'family'>('audience')
  const [audience, setAudience] = useState<Audience[]>([])
  const [familyName, setFamilyName] = useState('')
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'America/New_York'
    }
  })
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function addMember() {
    setMembers([...members, { name: '', age: '', role: 'kid' }])
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, i) => i !== index))
  }

  function updateMember(index: number, field: keyof FamilyMember, value: string) {
    const updated = [...members]
    updated[index] = { ...updated[index], [field]: value }
    setMembers(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in to complete onboarding.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ family_name: familyName, timezone, audience })
      .eq('id', user.id)

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    const validMembers = members.filter((m) => m.name.trim() !== '')
    if (validMembers.length > 0) {
      const rows = validMembers.map((m) => ({
        user_id: user.id,
        name: m.name.trim(),
        age: m.age ? parseInt(m.age, 10) : null,
        role: m.role,
      }))

      const { error: membersError } = await supabase
        .from('household_members')
        .insert(rows)

      if (membersError) {
        setError(membersError.message)
        setLoading(false)
        return
      }
    }

    router.push('/paper')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-stone-800">
            Poopin&apos; Papers
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            A family newspaper, delivered weekly
          </p>
        </div>

        {step === 'audience' && (
          <>
            <h2 className="mb-2 text-xl font-semibold text-stone-700">
              Who&apos;s reading this?
            </h2>
            <p className="mb-6 text-sm text-stone-500">
              We&apos;ll tailor the jokes, tone, and content to your audience.
            </p>

            <div className="space-y-3">
              {AUDIENCE_OPTIONS.map((option) => {
                const selected = audience.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setAudience((prev) =>
                        selected
                          ? prev.filter((a) => a !== option.value)
                          : [...prev, option.value]
                      )
                    }
                    className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                      selected
                        ? 'border-amber-500 bg-amber-50 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{option.emoji}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-stone-800">
                          {option.label}
                        </div>
                        <div className="text-sm text-stone-500">
                          {option.description}
                        </div>
                      </div>
                      {selected && (
                        <span className="text-amber-600 text-xl">&#10003;</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <p className="mt-3 text-center text-xs text-stone-400">
              Select all that apply
            </p>

            <button
              type="button"
              disabled={audience.length === 0}
              onClick={() => setStep('family')}
              className="mt-4 w-full rounded-lg bg-amber-600 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              Next
            </button>
          </>
        )}

        {step === 'family' && (
          <>
            <div className="mb-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('audience')}
                className="rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
              >
                &larr; Back
              </button>
              <h2 className="text-xl font-semibold text-stone-700">
                Tell us about your family
              </h2>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Family name */}
              <div>
                <label
                  htmlFor="familyName"
                  className="mb-1 block text-sm font-medium text-stone-700"
                >
                  Family Name
                </label>
                <input
                  id="familyName"
                  type="text"
                  required
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="e.g. The Johnsons"
                />
              </div>

              {/* Timezone */}
              <div>
                <label
                  htmlFor="timezone"
                  className="mb-1 block text-sm font-medium text-stone-700"
                >
                  Timezone
                </label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  {US_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Family members */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-stone-700">
                    Family Members <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={addMember}
                    className="rounded-lg bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200"
                  >
                    + Add member
                  </button>
                </div>

                <div className="space-y-3">
                  {members.length === 0 && (
                    <p className="text-sm text-stone-400 py-2">
                      You can add family members now or later in settings.
                    </p>
                  )}
                  {members.map((member, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-stone-200 bg-stone-50 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Name"
                            value={member.name}
                            onChange={(e) =>
                              updateMember(index, 'name', e.target.value)
                            }
                            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            placeholder="Age"
                            min="0"
                            max="120"
                            value={member.age}
                            onChange={(e) =>
                              updateMember(index, 'age', e.target.value)
                            }
                            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                        <div className="w-24">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateMember(index, 'role', e.target.value)
                            }
                            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          >
                            <option value="parent">Parent</option>
                            <option value="kid">Kid</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(index)}
                          className="rounded-lg px-2 py-2 text-sm text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Remove member"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-amber-600 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Get Started'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
