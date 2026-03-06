'use client'

import Link from 'next/link'
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
]

const SECTION_META: Record<SectionType, { emoji: string; label: string }> = {
  this_week: { emoji: '\uD83D\uDCC5', label: 'This Week' },
  meal_plan: { emoji: '\uD83C\uDF7D\uFE0F', label: 'Meal Plan' },
  chores: { emoji: '\uD83E\uDDF9', label: 'Chores' },
  coaching: { emoji: '\uD83D\uDCAA', label: 'Parent Coaching' },
  fun_zone: { emoji: '\uD83C\uDF89', label: 'Fun Zone' },
  brain_fuel: { emoji: '\uD83E\uDDE0', label: 'Brain Fuel' },
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
  const sectionMap = new Map(sections.map(s => [s.section_type, s]))
  const kidAges = members
    .filter(m => m.role === 'kid' && m.age !== null)
    .map(m => m.age as number)

  async function toggleEnabled(section: PaperSection, enabled: boolean) {
    await fetch(`/api/papers/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-serif text-xl text-stone-800">
          Week of {formatWeekOf(paper.week_start)}
        </h2>
        <Link
          href={`/preview/${paper.id}`}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Preview &amp; Print
        </Link>
      </div>

      <div className="space-y-6">
        {SECTION_ORDER.map(type => {
          const section = sectionMap.get(type)
          if (!section) return null
          const meta = SECTION_META[type]

          return (
            <div
              key={section.id}
              className="rounded-lg border border-stone-200 bg-white p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-lg text-stone-800">
                  {meta.emoji} {meta.label}
                </h3>
                <label className="flex items-center gap-2 text-sm text-stone-500">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={e => toggleEnabled(section, e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  Enabled
                </label>
              </div>

              {section.enabled && (
                <SectionEditor
                  section={section}
                  ages={kidAges}
                  members={members}
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
}: {
  section: PaperSection
  ages: number[]
  members: HouseholdMember[]
}) {
  switch (section.section_type) {
    case 'this_week':
      return <ThisWeekEditor section={section} />
    case 'meal_plan':
      return <MealPlanEditor section={section} />
    case 'chores':
      return <ChoresEditor section={section} members={members} />
    case 'coaching':
    case 'fun_zone':
    case 'brain_fuel':
      return (
        <GeneratedContentEditor section={section} ages={ages} />
      )
    default:
      return null
  }
}
