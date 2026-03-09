'use client'

import { useState, useCallback } from 'react'
import type { PaperSection, MealPlanContent } from '@/lib/types/database'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MEALS = ['breakfast', 'lunch', 'dinner'] as const

function getInitialMeals(content: Record<string, unknown>): MealPlanContent['meals'] {
  const c = content as MealPlanContent
  if (c.meals) return c.meals
  const empty: MealPlanContent['meals'] = {}
  for (const day of DAYS) {
    empty[day] = { breakfast: '', lunch: '', dinner: '' }
  }
  return empty
}

export default function MealPlanEditor({
  section,
  onSave,
}: {
  section: PaperSection
  onSave?: (p: Promise<unknown>) => void
}) {
  const [meals, setMeals] = useState<MealPlanContent['meals']>(
    () => getInitialMeals(section.content)
  )

  const save = useCallback(
    (updated: MealPlanContent['meals']) => {
      const p = fetch(`/api/papers/sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { meals: updated } }),
      })
      onSave?.(p)
    },
    [section.id, onSave]
  )

  function handleChange(day: string, meal: string, value: string) {
    setMeals(prev => {
      const updated = {
        ...prev,
        [day]: { ...prev[day], [meal]: value },
      }
      return updated
    })
  }

  function handleBlur() {
    save(meals)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="pb-2 pr-2 text-left text-xs font-medium uppercase text-stone-500" />
            {DAY_LABELS.map(d => (
              <th
                key={d}
                className="pb-2 px-1 text-center text-xs font-medium uppercase text-stone-500"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEALS.map(meal => (
            <tr key={meal}>
              <td className="py-1 pr-2 text-xs font-medium capitalize text-stone-600">
                {meal}
              </td>
              {DAYS.map((day, i) => (
                <td key={day} className="p-1">
                  <input
                    type="text"
                    value={meals[day]?.[meal] ?? ''}
                    onChange={e => handleChange(day, meal, e.target.value)}
                    onBlur={handleBlur}
                    className="w-full rounded border border-stone-200 px-2 py-1 text-xs text-stone-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder={DAY_LABELS[i]}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
