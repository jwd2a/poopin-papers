import Anthropic from '@anthropic-ai/sdk'

function getClient() {
  return new Anthropic()
}

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

    default:
      return `Write a short, engaging piece of content for a family newsletter section called "${sectionType}". Return JSON: {"title": "...", "body": "..."}`
  }
}

export async function generateContent(
  sectionType: string,
  ages: number[] = []
): Promise<{ title: string; body: string }> {
  const prompt = buildContentPrompt(sectionType, ages)

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response')
  }

  return JSON.parse(jsonMatch[0])
}
