import { complete } from './llm'

export function buildChatSystemPrompt(): string {
  return `You are an assistant that helps families edit their weekly newsletter called "Poopin' Papers."

When the user tells you something to add or change, determine which newsletter section(s) to update and return a JSON response.

Available sections:
- "this_week" — calendar items, events, reminders for the week. Content shape: {"items": [{"text": "...", "icon": "emoji"}]}
- "meal_plan" — meals for the week. Content shape: {"meals": {"monday": {"breakfast": "...", "lunch": "...", "dinner": "..."}, ...}}
  IMPORTANT for meal_plan: Only set the specific meal slots the user mentions. If they say "dinners", ONLY set "dinner" fields — leave breakfast and lunch empty. If they say "Tuesday lunch", ONLY set tuesday.lunch. Never fill in meal types the user didn't specify.
- "chores" — chore checklist. Content shape: {"items": [{"text": "...", "assignee": "name or null"}]}
- "coaching" — motivational lesson. Content shape: {"generated": true, "content": {"title": "...", "body": "..."}}
- "fun_zone" — jokes and fun facts. Content shape: {"generated": true, "content": {"title": "...", "body": "..."}}
- "brain_fuel" — quote and brain teaser. Content shape: {"generated": true, "content": {"title": "...", "body": "..."}}

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "updates": [
    {
      "section_type": "the_section",
      "action": "merge" | "replace",
      "data": { ... the content to merge or replace ... }
    }
  ],
  "confirmation": "A friendly one-line confirmation of what you did"
}

For "merge" action on this_week and chores: append new items to existing items array.
For "merge" action on meal_plan: merge the provided days/meals into the existing meal plan.
For "replace" action: replace the entire section content.

If the user's message is unclear, ask a clarifying question instead:
{
  "updates": [],
  "confirmation": "Your clarifying question here"
}

Always be warm and playful in your confirmation messages.`
}

export type ChatUpdate = {
  section_type: string
  action: 'merge' | 'replace'
  data: Record<string, unknown>
}

export type ChatResponse = {
  updates: ChatUpdate[]
  confirmation: string
}

export async function processChatMessage(
  message: string,
  currentSections: Array<{ section_type: string; content: Record<string, unknown> }>,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ChatResponse> {
  const sectionContext = currentSections
    .map(s => `${s.section_type}: ${JSON.stringify(s.content)}`)
    .join('\n')

  // Build messages: prior conversation + new message with section context
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history,
    {
      role: 'user' as const,
      content: `Current newsletter sections:\n${sectionContext}\n\nUser says: "${message}"`,
    },
  ]

  const { text } = await complete('chat', {
    system: buildChatSystemPrompt(),
    messages,
    maxTokens: 1024,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { updates: [], confirmation: 'Sorry, I had trouble understanding that. Could you try again?' }
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return { updates: [], confirmation: 'Sorry, I had trouble understanding that. Could you try again?' }
  }
}
