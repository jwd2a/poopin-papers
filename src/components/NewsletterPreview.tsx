'use client'

import type { PaperSection } from '@/lib/types/database'
import { arrangeSections, getMealEntries, SECTION_TITLES, COLORS, formatWeekDate } from '@/lib/pdf/layout'

type Props = {
  familyName: string
  weekStart: string
  sections: PaperSection[]
  issueNumber?: number
}

// --- Section renderers ---

function ThisWeekSection({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<{ text: string; icon?: string }>) ?? []
  if (items.length === 0) return null
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>This Week</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', marginBottom: 3, gap: 4 }}>
          <span style={{ fontSize: 9, width: 14, flexShrink: 0 }}>{item.icon ?? '*'}</span>
          <span style={{ flex: 1, fontSize: 9.5, lineHeight: 1.4, color: COLORS.textMuted }}>{item.text}</span>
        </div>
      ))}
    </div>
  )
}

function ChoresSection({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<{ text: string; assignee?: string | null }>) ?? []
  if (items.length === 0) return null
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>Weekly Chores</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 3, gap: 5 }}>
          <div style={{
            width: 9, height: 9, border: `1px solid ${COLORS.textMuted}`,
            borderRadius: 1, flexShrink: 0,
          }} />
          <span style={{ flex: 1, fontSize: 9.5, color: COLORS.textMuted }}>{item.text}</span>
          {item.assignee && (
            <span style={{ fontSize: 8, color: COLORS.textLight, fontStyle: 'italic' }}>({item.assignee})</span>
          )}
        </div>
      ))}
    </div>
  )
}

function MealPlanSection({ content }: { content: Record<string, unknown> }) {
  const entries = getMealEntries(content)
  if (entries.length === 0) return null
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>Meal Plan</div>
      {entries.map((entry, i) => (
        <div key={i} style={{ display: 'flex', marginBottom: 2, gap: 4 }}>
          <span style={{ width: 55, fontSize: 9, fontWeight: 'bold', color: COLORS.text, textTransform: 'capitalize' as const }}>
            {entry.day}
          </span>
          <span style={{ flex: 1, fontSize: 9, color: COLORS.textMuted }}>{entry.description}</span>
        </div>
      ))}
    </div>
  )
}

function GeneratedSection({ title, content }: { title: string; content: Record<string, unknown> }) {
  const inner = content.content as { title?: string; body?: string } | undefined
  if (!inner?.body) return null
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>{title}</div>
      {inner.title && (
        <div style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.text, marginBottom: 3 }}>{inner.title}</div>
      )}
      <div style={{ fontSize: 9.5, lineHeight: 1.5, color: COLORS.textMuted, whiteSpace: 'pre-line' }}>{inner.body}</div>
    </div>
  )
}

function renderSection(section: PaperSection) {
  switch (section.section_type) {
    case 'this_week':
      return <ThisWeekSection content={section.content} />
    case 'chores':
      return <ChoresSection content={section.content} />
    case 'meal_plan':
      return <MealPlanSection content={section.content} />
    case 'coaching':
    case 'fun_zone':
    case 'brain_fuel':
      return (
        <GeneratedSection
          title={SECTION_TITLES[section.section_type] ?? section.section_type}
          content={section.content}
        />
      )
    default:
      return null
  }
}

// --- Shared inline styles (mirroring react-pdf styles) ---

const sectionStyle: React.CSSProperties = {
  flex: 1,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 3,
  padding: 8,
  overflow: 'hidden',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 'bold',
  textTransform: 'uppercase',
  color: COLORS.text,
  marginBottom: 5,
  paddingBottom: 3,
  borderBottom: `0.5px solid ${COLORS.border}`,
}

// --- Main preview component ---

export function NewsletterPreview({ familyName, weekStart, sections, issueNumber }: Props) {
  const { topSections, midSections, bottomSections } = arrangeSections(sections)
  const dateStr = formatWeekDate(weekStart)

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, Georgia, serif",
      fontSize: 10,
      color: COLORS.text,
      padding: 36,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Masthead */}
      <div style={{
        textAlign: 'center',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottom: `2px solid ${COLORS.borderDark}`,
      }}>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 2 }}>
          Poopin&apos; Papers
        </div>
        <div style={{ fontSize: 9, fontStyle: 'italic', color: COLORS.textLight, marginBottom: 3 }}>
          Your weekly digest of household happenings, crafted with care
        </div>
        <div style={{ fontSize: 8, fontWeight: 'bold', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Week of {dateStr}
          {issueNumber ? ` \u00B7 Issue #${issueNumber}` : ''}
          {familyName ? ` \u00B7 ${familyName} Edition` : ''}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Top sections — full width */}
        {topSections.map((s) => (
          <div key={s.id}>{renderSection(s)}</div>
        ))}

        {/* Mid row — side by side */}
        {midSections.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {midSections.map((s) => (
              <div key={s.id} style={{ flex: 1 }}>{renderSection(s)}</div>
            ))}
          </div>
        )}

        {/* Bottom row — side by side */}
        {bottomSections.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {bottomSections.map((s) => (
              <div key={s.id} style={{ flex: 1 }}>{renderSection(s)}</div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 6,
        paddingTop: 4,
        borderTop: `1px solid ${COLORS.border}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 7, color: COLORS.textLight, fontStyle: 'italic' }}>
          Lovingly assembled for the {familyName || 'Family'} household
          {' \u00B7 '}Printed fresh every week{' \u00B7 '}Please recycle (or compost)
        </div>
      </div>
    </div>
  )
}
