'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MAX_SECTIONS = 6

const ALL_SECTIONS = [
  { type: 'this_week', label: 'This Week', emoji: '📅' },
  { type: 'meal_plan', label: 'Meal Plan', emoji: '🍽️' },
  { type: 'chores', label: 'Chores', emoji: '🧹' },
  { type: 'coaching', label: 'Parent Coaching', emoji: '💪' },
  { type: 'fun_zone', label: 'Fun Zone', emoji: '🎉' },
  { type: 'brain_fuel', label: 'Brain Fuel', emoji: '🧠' },
  { type: 'custom', label: 'Custom', emoji: '✨' },
] as const

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

export default function SettingsPage() {
  const [familyName, setFamilyName] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [intranetUrl, setIntranetUrl] = useState('')
  const [enabledSections, setEnabledSections] = useState<string[]>(
    ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores']
  )
  const [customTitle, setCustomTitle] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_name, timezone, intranet_url, enabled_sections, custom_section_title, custom_section_prompt')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFamilyName(profile.family_name ?? '')
        setTimezone(profile.timezone ?? 'America/New_York')
        setIntranetUrl(profile.intranet_url ?? '')
        setEnabledSections(profile.enabled_sections ?? ['this_week', 'coaching', 'fun_zone', 'brain_fuel', 'chores'])
        setCustomTitle(profile.custom_section_title ?? '')
        setCustomPrompt(profile.custom_section_prompt ?? '')
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({
        family_name: familyName,
        timezone,
        intranet_url: intranetUrl.trim() || null,
        enabled_sections: enabledSections,
        custom_section_title: customTitle.trim() || null,
        custom_section_prompt: customPrompt.trim() || null,
      })
      .eq('id', user.id)

    // Invalidate composed HTML so the paper recomposes with updated profile
    await supabase
      .from('papers')
      .update({ composed_html: null })
      .eq('user_id', user.id)

    setSaving(false)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-stone-500">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg py-8 px-4">
      <h1 className="mb-6 text-2xl font-bold text-stone-800">Settings</h1>

      <form onSubmit={handleSave} className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        {/* Family Name */}
        <div className="mb-4">
          <label
            htmlFor="family_name"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Family Name
          </label>
          <input
            id="family_name"
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="e.g. The Smiths"
          />
        </div>

        {/* Timezone */}
        <div className="mb-6">
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

        {/* Intranet URL */}
        <div className="mb-6">
          <label
            htmlFor="intranet_url"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Family Intranet URL
          </label>
          <input
            id="intranet_url"
            type="text"
            value={intranetUrl}
            onChange={(e) => setIntranetUrl(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="e.g. http://jabby.home"
          />
          <p className="mt-1 text-xs text-stone-400">
            If set, a QR code linking here will appear in every newsletter
          </p>
        </div>

        {/* Newsletter Sections */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-stone-700">
            Newsletter Sections
            <span className="ml-2 text-xs font-normal text-stone-400">
              ({enabledSections.length}/{MAX_SECTIONS} active)
            </span>
          </label>
          <div className="space-y-2">
            {ALL_SECTIONS.map(({ type, label, emoji }) => {
              const isEnabled = enabledSections.includes(type)
              const atMax = enabledSections.length >= MAX_SECTIONS && !isEnabled

              return (
                <div key={type}>
                  <label
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                      isEnabled
                        ? 'border-amber-300 bg-amber-50'
                        : atMax
                          ? 'border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed'
                          : 'border-stone-200 bg-white cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={atMax}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEnabledSections(prev => [...prev, type])
                        } else {
                          setEnabledSections(prev => prev.filter(s => s !== type))
                        }
                      }}
                      className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-base">{emoji}</span>
                    <span className="text-sm font-medium text-stone-700">{label}</span>
                  </label>

                  {type === 'custom' && isEnabled && (
                    <div className="ml-10 mt-2 space-y-2">
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="Section title (e.g. Bible Verse)"
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Describe what content to generate (e.g. Find a relevant bible verse and write a short family reflection)"
                        rows={2}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {showSaved && (
            <span className="text-sm font-medium text-green-600">Saved!</span>
          )}
        </div>
      </form>
    </div>
  )
}
