import { complete } from './llm'
import { DESIGN_SYSTEM } from './design-system'
import type { PaperSection, Profile } from '@/lib/types/database'

function buildCompositionPrompt(
  profile: Pick<Profile, 'family_name'>,
  sections: PaperSection[],
  weekStart: string,
  issueNumber?: number
): string {
  const enabledSections = sections.filter(s => s.enabled)

  const sectionData = enabledSections.map(s => {
    return `### ${s.section_type}\n${JSON.stringify(s.content, null, 2)}`
  }).join('\n\n')

  return `Compose a single-page printable HTML newsletter with the following data:

**Family Name:** ${profile.family_name || 'Our Family'}
**Week of:** ${weekStart}
${issueNumber ? `**Issue #:** ${issueNumber}` : ''}

## Sections to include:
${sectionData}

${enabledSections.length < 6 ? `\nNote: Only ${enabledSections.length} sections have content this week. Use the space well — expand sections or use creative whitespace. Do NOT show empty sections.` : ''}

Follow the design system exactly. Return ONLY the complete HTML document.`
}

export async function composeNewsletter(
  profile: Pick<Profile, 'family_name'>,
  sections: PaperSection[],
  weekStart: string,
  issueNumber?: number
): Promise<string> {
  const prompt = buildCompositionPrompt(profile, sections, weekStart, issueNumber)

  const { text } = await complete('compose', {
    system: DESIGN_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 8192,
  })

  // Strip any markdown code fences if present
  return text.replace(/^```html?\n?/, '').replace(/\n?```$/, '').trim()
}
