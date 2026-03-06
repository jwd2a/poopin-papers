import { describe, it, expect } from 'vitest'
import { buildContentPrompt } from '../content'

describe('buildContentPrompt', () => {
  it('builds coaching prompt with ages', () => {
    const prompt = buildContentPrompt('coaching', [8, 12])
    expect(prompt).toContain('coaching')
    expect(prompt).toContain('8')
    expect(prompt).toContain('12')
  })

  it('builds fun_zone prompt without ages', () => {
    const prompt = buildContentPrompt('fun_zone', [])
    expect(prompt).toContain('joke')
  })

  it('builds brain_fuel prompt', () => {
    const prompt = buildContentPrompt('brain_fuel', [10])
    expect(prompt).toContain('quote')
    expect(prompt).toContain('brain teaser')
  })
})
