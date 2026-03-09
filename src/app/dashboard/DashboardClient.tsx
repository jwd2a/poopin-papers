'use client'

import { useState, useRef, useCallback } from 'react'
import type {
  Paper,
  PaperSection,
  Profile,
  HouseholdMember,
  SectionType,
} from '@/lib/types/database'
import MealPlanEditor from '@/components/section-editors/MealPlanEditor'
import ChoresEditor from '@/components/section-editors/ChoresEditor'
import ThisWeekEditor from '@/components/section-editors/ThisWeekEditor'
import GeneratedContentEditor from '@/components/section-editors/GeneratedContentEditor'

const SECTION_ORDER: SectionType[] = [
  'this_week',
  'meal_plan',
  'chores',
  'coaching',
  'fun_zone',
  'brain_fuel',
  'custom',
]

const SECTION_META: Record<SectionType, { emoji: string; label: string }> = {
  this_week: { emoji: '\uD83D\uDCC5', label: 'This Week' },
  meal_plan: { emoji: '\uD83C\uDF7D\uFE0F', label: 'Meal Plan' },
  chores: { emoji: '\uD83E\uDDF9', label: 'Chores' },
  coaching: { emoji: '\uD83D\uDCAA', label: 'Parent Coaching' },
  fun_zone: { emoji: '\uD83C\uDF89', label: 'Fun Zone' },
  brain_fuel: { emoji: '\uD83E\uDDE0', label: 'Brain Fuel' },
  custom: { emoji: '✨', label: 'Custom' },
}

function formatWeekOf(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DashboardClient({
  paper,
  sections,
  profile,
  members,
}: {
  paper: Paper
  sections: PaperSection[]
  profile: Profile
  members: HouseholdMember[]
}) {
  const [composing, setComposing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const [enabledState, setEnabledState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map(s => [s.id, s.enabled]))
  )
  const sectionMap = new Map(sections.map(s => [s.section_type, s]))
  const kidAges = members
    .filter(m => m.role === 'kid' && m.age !== null)
    .map(m => m.age as number)

  const onSave = useCallback(async (promise: Promise<unknown>) => {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      await promise
      setSaveStatus('saved')
      saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [])

  async function toggleEnabled(section: PaperSection, enabled: boolean) {
    setEnabledState(prev => ({ ...prev, [section.id]: enabled }))
    const p = fetch(`/api/papers/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    onSave(p)
  }

  async function handlePreview() {
    setComposing(true)
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: paper.id }),
      })
      if (!res.ok) throw new Error('Compose failed')
      // Full page navigation to bypass Next.js router cache
      window.location.href = `/preview/${paper.id}`
    } catch {
      setComposing(false)
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-stone-800">
            Week of {formatWeekOf(paper.week_start)}
          </h2>
          <p className="text-xs text-stone-400 mt-1">Changes auto-save as you edit</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs transition-opacity duration-300 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}>
            {saveStatus === 'saving' && (
              <span className="text-amber-600 animate-pulse">Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-600">Saved</span>
            )}
          </span>
          <button
            onClick={handlePreview}
            disabled={composing || saveStatus === 'saving'}
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {composing ? 'Composing...' : 'Preview & Print'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {SECTION_ORDER.map(type => {
          const section = sectionMap.get(type)
          if (!section) return null
          const meta = SECTION_META[type]
          const label = section.section_type === 'custom'
            ? ((section.content as any)?.content?.title || 'Custom')
            : meta?.label ?? section.section_type

          return (
            <div
              key={section.id}
              className="rounded-lg border border-stone-200 bg-white p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-lg text-stone-800">
                  {meta.emoji} {label}
                </h3>
                <label className="flex items-center gap-2 text-sm text-stone-500">
                  <input
                    type="checkbox"
                    checked={enabledState[section.id] ?? section.enabled}
                    onChange={e => toggleEnabled(section, e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  Enabled
                </label>
              </div>

              {(enabledState[section.id] ?? section.enabled) && (
                <SectionEditor
                  section={section}
                  ages={kidAges}
                  members={members}
                  onSave={onSave}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectionEditor({
  section,
  ages,
  members,
  onSave,
}: {
  section: PaperSection
  ages: number[]
  members: HouseholdMember[]
  onSave: (p: Promise<unknown>) => void
}) {
  switch (section.section_type) {
    case 'this_week':
      return <ThisWeekEditor section={section} onSave={onSave} />
    case 'meal_plan':
      return <MealPlanEditor section={section} onSave={onSave} />
    case 'chores':
      return <ChoresEditor section={section} members={members} onSave={onSave} />
    case 'coaching':
    case 'fun_zone':
    case 'brain_fuel':
    case 'custom':
      return (
        <GeneratedContentEditor section={section} ages={ages} onSave={onSave} />
      )
    default:
      return null
  }
}
