'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

export default function OnboardingPage() {
  const router = useRouter()
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
      .update({ family_name: familyName, timezone })
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

        <h2 className="mb-6 text-xl font-semibold text-stone-700">
          Tell us about your family
        </h2>

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
      </div>
    </div>
  )
}
