import { complete } from './llm'

export function buildContentPrompt(sectionType: string, ages: number[]): string {
  const ageContext = ages.length > 0
    ? `The family has kids aged ${ages.join(', ')}.`
    : 'The family has children.'

  switch (sectionType) {
    case 'coaching':
      return `Write a short coaching/motivational lesson for a family bathroom newsletter. ${ageContext} The lesson should be age-appropriate, warm, and actionable. Include a catchy title and a 3-4 sentence body. The tone should be encouraging and conversational — like a cool parent or mentor talking to kids. Return JSON: {"title": "...", "body": "..."}`

    case 'fun_zone':
      return `Write content for the "Fun Zone" section of a family bathroom newsletter. ${ageContext} Include: 2 kid-friendly jokes (Q&A format) and 1 fun "Did You Know?" fact. Keep it age-appropriate, playful, and genuinely funny — not corny. Return JSON: {"title": "The Fun Zone", "body": "..."} where body contains the jokes and fact formatted with line breaks.`

    case 'brain_fuel':
      return `Write content for the "Brain Fuel" section of a family bathroom newsletter. ${ageContext} Include: 1 inspirational quote (with attribution) and 1 brain teaser with the answer in parentheses. Keep it age-appropriate and engaging. Return JSON: {"title": "Brain Fuel", "body": "..."} where body contains the quote and brain teaser.`

    case 'this_week':
      return `Generate 3-4 items for the "This Week" section of a family bathroom newsletter for the week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Include seasonal or date-relevant items (holidays, weather, school events, daylight changes, etc). Each item should be a short, actionable or fun note. Return JSON: {"items": [{"text": "...", "icon": "emoji"}, ...]}`

    default:
      return `Write a short, engaging piece of content for a family newsletter section called "${sectionType}". Return JSON: {"title": "...", "body": "..."}`
  }
}

export async function generateContent(
  sectionType: string,
  ages: number[] = []
): Promise<{ title: string; body: string }> {
  const prompt = buildContentPrompt(sectionType, ages)

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

export async function generateThisWeekContent(): Promise<{ items: Array<{ text: string; icon?: string }> }> {
  const prompt = buildContentPrompt('this_week', [])

  const { text } = await complete('content', {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1024,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')
  return JSON.parse(jsonMatch[0])
}
