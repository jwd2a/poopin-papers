import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../ai/content', () => ({
  generateContent: vi.fn(),
  generateThisWeekContent: vi.fn(),
}))

vi.mock('../ai/compose', () => ({
  composeNewsletter: vi.fn(),
}))

import { generateContent, generateThisWeekContent } from '../ai/content'
import { composeNewsletter } from '../ai/compose'
import { generateSharedEdition, SHARED_AUDIENCE } from '../editions'

const mockGenerateContent = vi.mocked(generateContent)
const mockGenerateThisWeekContent = vi.mocked(generateThisWeekContent)
const mockComposeNewsletter = vi.mocked(composeNewsletter)

describe('generateSharedEdition', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGenerateContent.mockResolvedValue({ title: 'Test Title', body: 'Test body' })
    mockGenerateThisWeekContent.mockResolvedValue({
      items: [{ text: 'Item 1', icon: '📅' }],
    })
    mockComposeNewsletter.mockResolvedValue('<html>composed</html>')
  })

  it('calls all 4 content generators with the shared audience', async () => {
    await generateSharedEdition('2026-03-01')

    expect(mockGenerateContent).toHaveBeenCalledWith('coaching', SHARED_AUDIENCE)
    expect(mockGenerateContent).toHaveBeenCalledWith('fun_zone', SHARED_AUDIENCE)
    expect(mockGenerateContent).toHaveBeenCalledWith('brain_fuel', SHARED_AUDIENCE)
    expect(mockGenerateThisWeekContent).toHaveBeenCalledWith(SHARED_AUDIENCE)
  })

  it('returns sections object with all expected keys', async () => {
    const result = await generateSharedEdition('2026-03-01')

    expect(result.sections).toHaveProperty('coaching')
    expect(result.sections).toHaveProperty('fun_zone')
    expect(result.sections).toHaveProperty('brain_fuel')
    expect(result.sections).toHaveProperty('this_week')
    expect(result.sections.coaching).toEqual({ title: 'Test Title', body: 'Test body' })
    expect(result.sections.this_week).toEqual({
      items: [{ text: 'Item 1', icon: '📅' }],
    })
  })

  it('returns composed_html from composeNewsletter', async () => {
    const result = await generateSharedEdition('2026-03-01')
    expect(result.composed_html).toBe('<html>composed</html>')
  })

  it('calls composeNewsletter with generic family name and reviewLayout', async () => {
    await generateSharedEdition('2026-03-01')

    expect(mockComposeNewsletter).toHaveBeenCalledTimes(1)
    const [profile, , weekStart, , options] = mockComposeNewsletter.mock.calls[0]
    expect(profile.family_name).toBe('Our Family')
    expect(weekStart).toBe('2026-03-01')
    expect(options).toEqual({ reviewLayout: true })
  })

  it('includes chores and all AI sections in the PaperSection array passed to compose', async () => {
    await generateSharedEdition('2026-03-01')

    const sections = mockComposeNewsletter.mock.calls[0][1]
    const types = sections.map((s: { section_type: string }) => s.section_type)
    expect(types).toContain('coaching')
    expect(types).toContain('fun_zone')
    expect(types).toContain('brain_fuel')
    expect(types).toContain('this_week')
    expect(types).toContain('chores')

    const chores = sections.find((s: { section_type: string }) => s.section_type === 'chores')
    expect((chores as any).content.items).toHaveLength(4)
  })

  it('SHARED_AUDIENCE includes kids, pre-teens, and teens', () => {
    expect(SHARED_AUDIENCE).toEqual(['kids', 'pre-teens', 'teens'])
  })
})
