import type { PaperSection } from '@/lib/types/database'

export const SECTION_TITLES: Record<string, string> = {
  coaching: 'Coaching Corner',
  fun_zone: 'Fun Zone',
  brain_fuel: 'Brain Fuel',
}

export const COLORS = {
  text: '#292524',
  textMuted: '#44403c',
  textLight: '#78716c',
  cream: '#fffbeb',
  amber: '#fef3c7',
  border: '#d6d3d1',
  borderDark: '#a8a29e',
}

export function isSectionEmpty(section: PaperSection): boolean {
  const content = section.content as Record<string, unknown>

  if (section.section_type === 'meal_plan') {
    const meals = content.meals as Record<string, Record<string, string>> | undefined
    if (!meals) return true
    return Object.values(meals).every((day) =>
      Object.values(day).every((meal) => !meal || meal.trim() === '')
    )
  }
  if (section.section_type === 'this_week' || section.section_type === 'chores') {
    const items = content.items as unknown[] | undefined
    return !items || items.length === 0
  }
  if (['coaching', 'fun_zone', 'brain_fuel'].includes(section.section_type)) {
    if (content.generated === false) return true
    const inner = content.content as { title?: string; body?: string } | undefined
    return !inner?.body
  }
  return false
}

export function getMealEntries(content: Record<string, unknown>): Array<{ day: string; description: string }> {
  const meals = content.meals as Record<string, Record<string, string>> | undefined
  if (!meals) return []

  const entries: Array<{ day: string; description: string }> = []
  for (const [day, dayMeals] of Object.entries(meals)) {
    const parts = Object.entries(dayMeals)
      .filter(([, meal]) => meal && meal.trim())
      .map(([, meal]) => meal)
    if (parts.length > 0) {
      entries.push({ day, description: parts.join(', ') })
    }
  }
  return entries
}

// A row is either a single full-width section or a pair of side-by-side sections
export type LayoutRow = { type: 'full'; section: PaperSection } | { type: 'pair'; sections: [PaperSection, PaperSection] }

export function arrangeSections(sections: PaperSection[]): LayoutRow[] {
  const live = sections.filter((s) => s.enabled && !isSectionEmpty(s))
  if (live.length === 0) return []

  // Separate by type
  const thisWeek = live.find((s) => s.section_type === 'this_week')
  const mealPlan = live.find((s) => s.section_type === 'meal_plan')
  const chores = live.find((s) => s.section_type === 'chores')
  const coaching = live.find((s) => s.section_type === 'coaching')
  const funZone = live.find((s) => s.section_type === 'fun_zone')
  const brainFuel = live.find((s) => s.section_type === 'brain_fuel')

  const rows: LayoutRow[] = []

  // This Week is always full-width at the top (it's short)
  if (thisWeek) {
    rows.push({ type: 'full', section: thisWeek })
  }

  // Meal plan: full-width if it has many entries, otherwise pair it
  if (mealPlan) {
    const entries = getMealEntries(mealPlan.content as Record<string, unknown>)
    if (entries.length > 4) {
      rows.push({ type: 'full', section: mealPlan })
    } else {
      // Try to pair with chores
      if (chores) {
        rows.push({ type: 'pair', sections: [mealPlan, chores] })
      } else {
        rows.push({ type: 'full', section: mealPlan })
      }
    }
  }

  // Collect remaining unpaired sections
  const remaining: PaperSection[] = []
  const mealPairedWithChores = mealPlan && chores && getMealEntries(mealPlan.content as Record<string, unknown>).length <= 4

  if (chores && !mealPairedWithChores) remaining.push(chores)
  if (coaching) remaining.push(coaching)
  if (funZone) remaining.push(funZone)
  if (brainFuel) remaining.push(brainFuel)

  // Pair remaining sections side-by-side, last one goes full-width if odd
  for (let i = 0; i < remaining.length; i += 2) {
    if (i + 1 < remaining.length) {
      rows.push({ type: 'pair', sections: [remaining[i], remaining[i + 1]] })
    } else {
      rows.push({ type: 'full', section: remaining[i] })
    }
  }

  return rows
}

export function formatWeekDate(weekStart: string): string {
  return new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
