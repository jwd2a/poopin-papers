import { describe, it, expect } from 'vitest'
import { buildContentPrompt } from '../content'

describe('buildContentPrompt', () => {
  it('builds coaching prompt for kids', () => {
    const prompt = buildContentPrompt('coaching', 'kids')
    expect(prompt).toContain('coaching')
    expect(prompt).toContain('ages 5-9')
  })

  it('builds fun_zone prompt for teens', () => {
    const prompt = buildContentPrompt('fun_zone', 'teens')
    expect(prompt).toContain('joke')
    expect(prompt).toContain('relatable')
  })

  it('builds brain_fuel prompt for pre-teens', () => {
    const prompt = buildContentPrompt('brain_fuel', 'pre-teens')
    expect(prompt).toContain('quote')
    expect(prompt).toContain('brain teaser')
  })
})
