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

  it('meal_plan is disabled by default, others enabled', () => {
    const sections = getDefaultSections()
    const mealPlan = sections.find(s => s.section_type === 'meal_plan')
    const others = sections.filter(s => s.section_type !== 'meal_plan')
    expect(mealPlan?.enabled).toBe(false)
    expect(others.every(s => s.enabled)).toBe(true)
  })

  it('all sections have overridden: false by default', () => {
    const sections = getDefaultSections()
    expect(sections.every(s => s.overridden === false)).toBe(true)
  })

  it('populates AI sections from shared edition when provided', () => {
    const edition = {
      id: 'test-id',
      week_start: '2026-03-01',
      sections: {
        coaching: { title: 'Coach Title', body: 'Coach Body' },
        fun_zone: { title: 'Fun Title', body: 'Fun Body' },
        brain_fuel: { title: 'Brain Title', body: 'Brain Body' },
        this_week: { items: [{ text: 'Item 1', icon: '📚' }] },
      },
      composed_html: null,
      issue_number: 1,
      created_at: '2026-03-01T00:00:00Z',
    }
    const sections = getDefaultSections(edition)
    const coaching = sections.find(s => s.section_type === 'coaching')
    expect(coaching?.content).toEqual({
      generated: true,
      content: { title: 'Coach Title', body: 'Coach Body' },
    })
    const thisWeek = sections.find(s => s.section_type === 'this_week')
    expect((thisWeek?.content as { items: unknown[] }).items).toEqual([
      { text: 'Item 1', icon: '📚' },
    ])
  })

  it('chores section has default items', () => {
    const sections = getDefaultSections()
    const chores = sections.find(s => s.section_type === 'chores')
    expect((chores?.content as { items: unknown[] }).items.length).toBeGreaterThan(0)
  })
})
