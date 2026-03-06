import { describe, it, expect } from 'vitest'
import { buildChatSystemPrompt } from '../chat'

describe('buildChatSystemPrompt', () => {
  it('includes all section types in the prompt', () => {
    const prompt = buildChatSystemPrompt()
    expect(prompt).toContain('meal_plan')
    expect(prompt).toContain('chores')
    expect(prompt).toContain('this_week')
    expect(prompt).toContain('coaching')
    expect(prompt).toContain('fun_zone')
    expect(prompt).toContain('brain_fuel')
  })

  it('specifies JSON output format', () => {
    const prompt = buildChatSystemPrompt()
    expect(prompt).toContain('JSON')
  })
})
