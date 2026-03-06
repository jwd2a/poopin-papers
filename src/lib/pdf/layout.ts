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

export function arrangeSections(sections: PaperSection[]) {
  const live = sections.filter((s) => s.enabled && !isSectionEmpty(s))

  const topSections: PaperSection[] = []
  const midSections: PaperSection[] = []
  const bottomSections: PaperSection[] = []

  for (const s of live) {
    if (s.section_type === 'this_week' || s.section_type === 'meal_plan') {
      topSections.push(s)
    } else if (s.section_type === 'chores') {
      midSections.unshift(s)
    } else {
      if (midSections.length < 2) {
        midSections.push(s)
      } else {
        bottomSections.push(s)
      }
    }
  }

  return { topSections, midSections, bottomSections }
}

export function formatWeekDate(weekStart: string): string {
  return new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
