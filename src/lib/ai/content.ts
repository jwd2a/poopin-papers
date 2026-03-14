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

/**
 * Build a date-context block for prompts so the AI knows what week it's writing for
 * and can reference relevant holidays, seasons, and events.
 */
function buildDateContext(weekStart: string): string {
  const date = new Date(weekStart + 'T12:00:00')
  const weekEnd = new Date(date)
  weekEnd.setDate(date.getDate() + 6)

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const month = date.getMonth() // 0-indexed
  const dayOfMonth = date.getDate()

  // Seasonal context
  let season = ''
  if (month >= 2 && month <= 4) season = 'spring'
  else if (month >= 5 && month <= 7) season = 'summer'
  else if (month >= 8 && month <= 10) season = 'fall/autumn'
  else season = 'winter'

  // Notable dates in the week range
  const notableDates: string[] = []
  const checkDate = new Date(date)
  for (let i = 0; i < 7; i++) {
    const m = checkDate.getMonth() + 1
    const d = checkDate.getDate()

    // Major US holidays and observances
    if (m === 1 && d === 1) notableDates.push("New Year's Day")
    if (m === 1 && d >= 15 && d <= 21 && checkDate.getDay() === 1) notableDates.push('Martin Luther King Jr. Day')
    if (m === 2 && d === 2) notableDates.push('Groundhog Day')
    if (m === 2 && d === 14) notableDates.push("Valentine's Day")
    if (m === 2 && d >= 15 && d <= 21 && checkDate.getDay() === 1) notableDates.push("Presidents' Day")
    if (m === 3 && d === 14) notableDates.push('Pi Day')
    if (m === 3 && d === 17) notableDates.push("St. Patrick's Day")
    if (m === 3 && d === 20) notableDates.push('First Day of Spring')
    if (m === 4 && d === 1) notableDates.push("April Fools' Day")
    if (m === 4 && d === 22) notableDates.push('Earth Day')
    if (m === 5 && d >= 8 && d <= 14 && checkDate.getDay() === 0) notableDates.push("Mother's Day")
    if (m === 5 && d >= 25 && d <= 31 && checkDate.getDay() === 1) notableDates.push('Memorial Day')
    if (m === 6 && d >= 15 && d <= 21 && checkDate.getDay() === 0) notableDates.push("Father's Day")
    if (m === 6 && d === 19) notableDates.push('Juneteenth')
    if (m === 6 && d === 20) notableDates.push('First Day of Summer')
    if (m === 7 && d === 4) notableDates.push('Independence Day')
    if (m === 9 && d >= 1 && d <= 7 && checkDate.getDay() === 1) notableDates.push('Labor Day')
    if (m === 9 && d === 22) notableDates.push('First Day of Fall')
    if (m === 10 && d === 31) notableDates.push('Halloween')
    if (m === 11 && d === 11) notableDates.push('Veterans Day')
    if (m === 11 && d >= 22 && d <= 28 && checkDate.getDay() === 4) notableDates.push('Thanksgiving')
    if (m === 12 && d === 21) notableDates.push('First Day of Winter')
    if (m === 12 && d === 25) notableDates.push('Christmas')
    if (m === 12 && d === 31) notableDates.push("New Year's Eve")

    checkDate.setDate(checkDate.getDate() + 1)
  }

  let context = `TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.\n`
  context += `THIS EDITION IS FOR THE WEEK OF: ${formatDate(date)} through ${formatDate(weekEnd)}.\n`
  context += `SEASON: ${season}.\n`
  if (notableDates.length > 0) {
    context += `NOTABLE DATES THIS WEEK: ${notableDates.join(', ')}.\n`
  }
  context += `All content MUST be relevant to this specific week and date. Reference the season, time of year, or upcoming events naturally.`

  return context
}

export function buildContentPrompt(sectionType: string, audience: Audience | Audience[], pastContent?: string, customPrompt?: string, weekStart?: string): string {
  const audiences = Array.isArray(audience) ? audience : [audience]
  const tone = audienceToTone(audiences)

  const dateContext = weekStart ? buildDateContext(weekStart) : `TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`

  const brevity = 'IMPORTANT: This is for a PRINTED one-page newsletter that gets hung on a wall and read throughout the week. Space is extremely limited. Be concise — every word must earn its place.'

  const readerContext = 'AUDIENCE: The people READING this are KIDS, not parents. Write FOR kids — the humor, language, and tone should land with children reading it on the wall. Parents might glance at it, but kids are the primary reader. Don\'t write advice directed at parents or use adult-to-adult framing.'

  const freshness = 'CRITICAL: Generate COMPLETELY ORIGINAL content. Do not reuse, paraphrase, or closely resemble any previously used content. Every joke, fact, quote, riddle, and tip must be brand new.'

  const staticArtifact = 'PRINT CONTEXT: This newsletter is printed once and displayed for the entire week. NEVER use relative time references like "tomorrow", "today", "this morning", "tonight", "yesterday", or "right now". Instead use specific days of the week ("on Monday", "this Thursday") or general phrasing ("this week", "the week ahead"). The reader might see it any day of the week.'

  const historyBlock = pastContent
    ? `\n\nPREVIOUSLY USED (do NOT reuse, rephrase, or closely resemble ANY of these — be completely original):\n${pastContent}`
    : ''

  switch (sectionType) {
    case 'coaching':
      return `${dateContext}\n\n${staticArtifact}\n\n${readerContext}\n\nWrite a coaching snippet for a kids' weekly newsletter called "Poopin' Papers" (it's hung in the bathroom and read throughout the week). ${tone} ${brevity} ${freshness}

VOICE: Like a cool older sibling or favorite uncle giving real advice — NOT a teacher or parent lecturing. Talk TO the kid, not ABOUT the kid. Think "here's a life hack" not "here's a lesson."

The tip should be timely — tie it to the season, time of year, or what kids are dealing with this week (school, friendships, sports, boredom, etc).

Include a catchy title (max 6 words) and body (3 sentences, around 50-60 words).

QUALITY GUIDE — GOOD coaching sounds like:
- "Feeling nervous about tryouts this week? Here's a secret: everyone else is nervous too. Pick one thing you're good at and lead with that. Confidence isn't about being perfect — it's about not caring if you mess up."
- "Spring break coming up? Make a 'boring jar' — write 20 random ideas on paper strips. Next time you're bored, pull one out. No take-backs."

BAD coaching sounds like:
- "Remember to be kind to each other! Kindness is the sunshine that makes the family garden grow." (too generic, too sappy, talking to parents)
- "Believe in yourself and anything is possible!" (empty platitude)
- "Listen to your parents because they know best." (preachy, no kid wants to read that)

Return JSON: {"title": "...", "body": "..."}${historyBlock}`

    case 'fun_zone':
      return `${dateContext}\n\n${staticArtifact}\n\n${readerContext}\n\nWrite the "Fun Zone" for a kids' weekly newsletter called "Poopin' Papers" (hung in the bathroom). ${tone} ${brevity} ${freshness}

Include: 2 jokes and 1 "Did You Know?" fact (one sentence).

JOKE QUALITY GUIDE:
Jokes should make people actually smile or groan-laugh. They can be puns, observational humor, one-liners, or Q&A — mix up the format. Tie to season/holidays when possible.

GOOD jokes (the bar to clear):
- "Q: Why do bees have sticky hair? A: Because they use honeycombs."
- "I told my suitcase we're not going on vacation this year. Now I'm dealing with emotional baggage."
- "Q: What do you call a fake noodle? A: An impasta."

BAD jokes (what to avoid):
- "Q: Why did the student eat his homework? A: Because the teacher said it was a piece of cake!" (ancient, everyone knows it)
- "Q: What's green and has wheels? A: Grass — I lied about the wheels." (random, not clever)
- Any joke that needs explaining or feels like it was generated by a computer

FACT: Make it genuinely surprising. Not "Did you know the sun is a star?" — more like "Honey never spoils — archaeologists found 3,000-year-old honey in Egyptian tombs that was still edible."

Return JSON: {"title": "Fun Zone", "body": "..."} with line breaks between items.${historyBlock}`

    case 'brain_fuel':
      return `${dateContext}\n\n${staticArtifact}\n\n${readerContext}\n\nWrite "Brain Fuel" for a kids' weekly newsletter called "Poopin' Papers." ${tone} ${brevity} ${freshness}

Include ONLY these two things:
1) A short inspirational quote with author attribution (max 15 words for the quote). Pick something genuinely thought-provoking — NOT the usual suspects (no "Be the change" Gandhi, no "Imagination is more important than knowledge" Einstein, no "The only way to do great work" Steve Jobs). Dig deeper. Find quotes from lesser-known thinkers, athletes, writers, or scientists that make you stop and think.
2) A brain teaser or riddle that's actually clever — NOT a classic everyone already knows (no "I have cities but no houses" or "What has hands but can't clap"). Make it original and satisfying to solve. Do NOT include the answer in the body.

Total body must be under 50 words. Return JSON: {"title": "Brain Fuel", "body": "...", "riddle_answer": "the answer to the riddle"}${historyBlock}`

    case 'this_week':
      return `${dateContext}\n\n${staticArtifact}\n\n${readerContext}\n\nGenerate 3 items for the "This Week" section of a kids' newsletter. ${tone} ${brevity} ${freshness} Each item: max 10 words. Items MUST be specific to this exact week — reference actual holidays, seasonal activities, school events typical for this time of year, or weather-appropriate family activities. Use specific day names (e.g. "St. Patrick's Day is Monday") not relative references. No generic filler. Return JSON: {"items": [{"text": "...", "icon": "emoji"}, ...]}${historyBlock}`

    default:
      if (customPrompt) {
        return `${dateContext}\n\n${staticArtifact}\n\n${readerContext}\n\nWrite content for a kids' newsletter section. Instructions from the user: "${customPrompt}". ${tone} ${brevity} ${freshness} Return JSON: {"title": "...", "body": "..."}${historyBlock}`
      }
      return `${dateContext}\n\n${staticArtifact}\n\n${readerContext}\n\nWrite a short piece for a kids' newsletter section called "${sectionType}". ${tone} ${brevity} ${freshness} Return JSON: {"title": "...", "body": "..."}${historyBlock}`
  }
}

/**
 * Extract JSON from an AI response that may include markdown fences,
 * commentary, or other wrapping text.
 */
function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  const cleaned = fenceMatch ? fenceMatch[1].trim() : text.trim()

  // Try parsing the cleaned text directly first (if it's pure JSON)
  try {
    JSON.parse(cleaned)
    return cleaned
  } catch {
    // Fall through to regex extraction
  }

  // Find the outermost balanced { } block
  const start = cleaned.indexOf('{')
  if (start === -1) throw new Error(`No JSON object found in AI response: ${text.slice(0, 200)}`)

  let depth = 0
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++
    else if (cleaned[i] === '}') {
      depth--
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1)
        // Validate it parses
        JSON.parse(candidate)
        return candidate
      }
    }
  }

  throw new Error(`Unbalanced JSON in AI response: ${text.slice(0, 200)}`)
}

export async function generateContent(
  sectionType: string,
  audience: Audience | Audience[] = ['kids'],
  pastContent?: string,
  customPrompt?: string,
  weekStart?: string,
): Promise<{ title: string; body: string }> {
  const prompt = buildContentPrompt(sectionType, audience, pastContent, customPrompt, weekStart)

  const { text } = await complete('content', {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1024,
  })

  return JSON.parse(extractJSON(text))
}

export async function generateThisWeekContent(
  audience: Audience | Audience[] = ['kids'],
  pastContent?: string,
  weekStart?: string,
): Promise<{ items: Array<{ text: string; icon?: string }> }> {
  const prompt = buildContentPrompt('this_week', audience, pastContent, undefined, weekStart)

  const { text } = await complete('content', {
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1024,
  })

  return JSON.parse(extractJSON(text))
}
