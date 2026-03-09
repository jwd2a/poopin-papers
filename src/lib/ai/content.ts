import { complete } from './llm'
import type { Audience } from '@/lib/types/database'

const AUDIENCE_TONE: Record<Audience, string> = {
  toddlers: 'toddlers (ages 2-4) — very simple words, short sentences, lots of excitement, picture-book level',
  kids: 'kids (ages 5-9) — fun, playful, easy to read, humor they would actually laugh at',
  'pre-teens': 'pre-teens (ages 10-12) — a bit more sophisticated but still playful, can handle more complex ideas',
  teens: 'teens (ages 13-17) — witty and relatable, not cringey or preachy, they can smell inauthenticity',
  adults: 'adults — grown-up humor, sophisticated references, warm but mature tone',
}

function audienceToTone(audiences: Audience[]): string {
  if (audiences.length === 0) return 'The audience is a general family.'
  if (audiences.length === 1) return `The audience is ${AUDIENCE_TONE[audiences[0]]}.`
  const descriptions = audiences.map((a) => AUDIENCE_TONE[a])
  return `The audience includes: ${descriptions.join('; ')}. Balance the content so it works for all age groups — accessible to the youngest but not boring for the oldest.`
}

export function buildContentPrompt(sectionType: string, audience: Audience | Audience[], pastContent?: string, customPrompt?: string): string {
  const audiences = Array.isArray(audience) ? audience : [audience]
  const tone = audienceToTone(audiences)

  const brevity = 'IMPORTANT: This is for a PRINTED one-page newsletter. Space is extremely limited. Be concise — every word must earn its place.'

  const historyBlock = pastContent
    ? `\n\nPREVIOUSLY USED (do NOT reuse any of these — generate completely fresh content):\n${pastContent}`
    : ''

  switch (sectionType) {
    case 'coaching':
      return `Write a coaching/motivational snippet for a family weekly newsletter. ${tone} ${brevity} Include a catchy title (max 6 words) and body (3 sentences, around 50-60 words). Return JSON: {"title": "...", "body": "..."}${historyBlock}`

    case 'fun_zone':
      return `Write the "Fun Zone" for a family weekly newsletter. ${tone} ${brevity} Include: 2 short jokes (Q&A format, one line each) and 1 "Did You Know?" fact (one sentence). Return JSON: {"title": "Fun Zone", "body": "..."} with line breaks between items.${historyBlock}`

    case 'brain_fuel':
      return `Write "Brain Fuel" for a family weekly newsletter. ${tone} ${brevity} Include ONLY these two things, nothing else: 1) A short inspirational quote with author attribution (max 15 words for the quote). 2) A one-sentence brain teaser/riddle — do NOT include the answer in the body. Total body must be under 50 words. Return JSON: {"title": "Brain Fuel", "body": "...", "riddle_answer": "the answer to the riddle"}${historyBlock}`

    case 'this_week':
      return `Generate 3 items for the "This Week" section of a family newsletter for the week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ${tone} ${brevity} Each item: max 10 words. Include seasonal/date-relevant items. Return JSON: {"items": [{"text": "...", "icon": "emoji"}, ...]}${historyBlock}`

    default:
      if (customPrompt) {
        return `Write content for a family newsletter section. Instructions from the user: "${customPrompt}". ${tone} ${brevity} Return JSON: {"title": "...", "body": "..."}${historyBlock}`
      }
      return `Write a short piece for a family newsletter section called "${sectionType}". ${tone} ${brevity} Return JSON: {"title": "...", "body": "..."}${historyBlock}`
  }
}

export async function generateContent(
  sectionType: string,
  audience: Audience | Audience[] = ['kids'],
  pastContent?: string,
  customPrompt?: string,
): Promise<{ title: string; body: string }> {
  const prompt = buildContentPrompt(sectionType, audience, pastContent, customPrompt)

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
  audience: Audience | Audience[] = ['kids'],
  pastContent?: string
): Promise<{ items: Array<{ text: string; icon?: string }> }> {
  const prompt = buildContentPrompt('this_week', audience, pastContent)

  const { text } = await complete('content', {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1024,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')
  return JSON.parse(jsonMatch[0])
}
