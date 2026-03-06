import { describe, it, expect } from 'vitest'
import { getCurrentWeekStart, getDefaultSections } from '../papers'

describe('getCurrentWeekStart', () => {
  it('returns the most recent Sunday', () => {
    const date = new Date('2026-03-05T12:00:00')
    const weekStart = getCurrentWeekStart(date)
    expect(weekStart).toBe('2026-03-01')
  })

  it('returns the same day if already Sunday', () => {
    const date = new Date('2026-03-01T12:00:00')
    const weekStart = getCurrentWeekStart(date)
    expect(weekStart).toBe('2026-03-01')
  })
})

describe('getDefaultSections', () => {
  it('returns all 6 section types', () => {
    const sections = getDefaultSections()
    const types = sections.map(s => s.section_type)
    expect(types).toEqual([
      'this_week', 'meal_plan', 'chores', 'coaching', 'fun_zone', 'brain_fuel'
    ])
  })

  it('all sections are enabled by default', () => {
    const sections = getDefaultSections()
    expect(sections.every(s => s.enabled)).toBe(true)
  })

  it('chores section has default items', () => {
    const sections = getDefaultSections()
    const chores = sections.find(s => s.section_type === 'chores')
    expect((chores?.content as { items: unknown[] }).items.length).toBeGreaterThan(0)
  })
})
