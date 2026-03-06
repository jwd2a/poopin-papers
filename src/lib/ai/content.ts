import { complete } from './llm'
import type { Audience } from '@/lib/types/database'

const AUDIENCE_TONE: Record<Audience, string> = {
  toddlers: 'The audience is toddlers (ages 2-4). Use very simple words, short sentences, and lots of excitement. Think picture-book level.',
  kids: 'The audience is kids (ages 5-9). Keep it fun, playful, and easy to read. Use humor they would actually laugh at.',
  'pre-teens': 'The audience is pre-teens (ages 10-12). A bit more sophisticated but still playful. They can handle more complex ideas.',
  teens: 'The audience is teens (ages 13-17). Be witty and relatable — not cringey or preachy. They can smell inauthenticity.',
  adults: 'The audience is adults. Use grown-up humor, sophisticated references, and a warm but mature tone.',
}

export function buildContentPrompt(sectionType: string, audience: Audience): string {
  const tone = AUDIENCE_TONE[audience]

  switch (sectionType) {
    case 'coaching':
      return `Write a short coaching/motivational lesson for a family bathroom newsletter. ${tone} The lesson should be age-appropriate, warm, and actionable. Include a catchy title and a 3-4 sentence body. The tone should be encouraging and conversational. Return JSON: {"title": "...", "body": "..."}`

    case 'fun_zone':
      return `Write content for the "Fun Zone" section of a family bathroom newsletter. ${tone} Include: 2 jokes (Q&A format) and 1 fun "Did You Know?" fact. Keep it age-appropriate, playful, and genuinely funny. Return JSON: {"title": "The Fun Zone", "body": "..."} where body contains the jokes and fact formatted with line breaks.`

    case 'brain_fuel':
      return `Write content for the "Brain Fuel" section of a family bathroom newsletter. ${tone} Include: 1 inspirational quote (with attribution) and 1 brain teaser with the answer in parentheses. Keep it age-appropriate and engaging. Return JSON: {"title": "Brain Fuel", "body": "..."} where body contains the quote and brain teaser.`

    case 'this_week':
      return `Generate 3-4 items for the "This Week" section of a family bathroom newsletter for the week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ${tone} Include seasonal or date-relevant items (holidays, weather, school events, daylight changes, etc). Each item should be a short, actionable or fun note. Return JSON: {"items": [{"text": "...", "icon": "emoji"}, ...]}`

    default:
      return `Write a short, engaging piece of content for a family newsletter section called "${sectionType}". ${tone} Return JSON: {"title": "...", "body": "..."}`
  }
}

export async function generateContent(
  sectionType: string,
  audience: Audience = 'kids'
): Promise<{ title: string; body: string }> {
  const prompt = buildContentPrompt(sectionType, audience)

  const { text } = await complete('content', {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1024,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response')
  }

  return JSON.parse(jsonMatch[0])
}

export async function generateThisWeekContent(
  audience: Audience = 'kids'
): Promise<{ items: Array<{ text: string; icon?: string }> }> {
  const prompt = buildContentPrompt('this_week', audience)

  const { text } = await complete('content', {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1024,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')
  return JSON.parse(jsonMatch[0])
}
