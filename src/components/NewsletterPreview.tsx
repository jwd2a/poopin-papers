'use client'

import type { PaperSection } from '@/lib/types/database'
import { arrangeSections, getMealEntries, SECTION_TITLES, COLORS, formatWeekDate, type LayoutRow } from '@/lib/pdf/layout'

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
    <>
      <div style={sectionHeaderStyle}>This Week</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', marginBottom: 4, gap: 6 }}>
          <span style={{ fontSize: '0.65rem', width: 16, flexShrink: 0 }}>{item.icon ?? '*'}</span>
          <span style={{ flex: 1, fontSize: '0.65rem', lineHeight: 1.4, color: COLORS.textMuted }}>{item.text}</span>
        </div>
      ))}
    </>
  )
}

function ChoresSection({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<{ text: string; assignee?: string | null }>) ?? []
  if (items.length === 0) return null
  return (
    <>
      <div style={sectionHeaderStyle}>Weekly Chores</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 6 }}>
          <div style={{
            width: 10, height: 10, border: `1.5px solid ${COLORS.textMuted}`,
            borderRadius: 1, flexShrink: 0,
          }} />
          <span style={{ flex: 1, fontSize: '0.65rem', color: COLORS.textMuted }}>{item.text}</span>
          {item.assignee && (
            <span style={{ fontSize: '0.6rem', color: COLORS.textLight, fontStyle: 'italic' }}>({item.assignee})</span>
          )}
        </div>
      ))}
    </>
  )
}

function MealPlanSection({ content }: { content: Record<string, unknown> }) {
  const entries = getMealEntries(content)
  if (entries.length === 0) return null
  return (
    <>
      <div style={sectionHeaderStyle}>Meal Plan</div>
      {entries.map((entry, i) => (
        <div key={i} style={{ display: 'flex', marginBottom: 3, gap: 6 }}>
          <span style={{ width: 60, fontSize: '0.6rem', fontWeight: 'bold', color: COLORS.text, textTransform: 'capitalize' as const }}>
            {entry.day}
          </span>
          <span style={{ flex: 1, fontSize: '0.6rem', color: COLORS.textMuted }}>{entry.description}</span>
        </div>
      ))}
    </>
  )
}

function GeneratedSection({ title, content }: { title: string; content: Record<string, unknown> }) {
  const inner = content.content as { title?: string; body?: string } | undefined
  if (!inner?.body) return null
  return (
    <>
      <div style={sectionHeaderStyle}>{title}</div>
      {inner.title && (
        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: COLORS.text, marginBottom: 4 }}>{inner.title}</div>
      )}
      <div style={{ fontSize: '0.65rem', lineHeight: 1.5, color: COLORS.textMuted, whiteSpace: 'pre-line' }}>{inner.body}</div>
    </>
  )
}

function renderSectionContent(section: PaperSection) {
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

// --- Shared inline styles ---

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  color: COLORS.text,
  marginBottom: 6,
  paddingBottom: 4,
  borderBottom: `1px solid ${COLORS.border}`,
  letterSpacing: 0.5,
}

const sectionBoxStyle: React.CSSProperties = {
  flex: 1,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  padding: 12,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

// --- Main preview component ---

export function NewsletterPreview({ familyName, weekStart, sections, issueNumber }: Props) {
  const rows = arrangeSections(sections)
  const dateStr = formatWeekDate(weekStart)

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, Georgia, serif",
      fontSize: '0.65rem',
      color: COLORS.text,
      padding: '0.5in',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minHeight: '11in',
      boxSizing: 'border-box',
    }}>
      {/* Masthead */}
      <div style={{
        textAlign: 'center',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `3px double ${COLORS.borderDark}`,
      }}>
        <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: COLORS.text, marginBottom: 2 }}>
          Poopin&apos; Papers
        </div>
        <div style={{ fontSize: '0.6rem', fontStyle: 'italic', color: COLORS.textLight, marginBottom: 4 }}>
          Your weekly digest of household happenings, crafted with care
        </div>
        <div style={{ fontSize: '0.55rem', fontWeight: 'bold', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Week of {dateStr}
          {issueNumber ? ` \u00B7 Issue #${issueNumber}` : ''}
          {familyName ? ` \u00B7 ${familyName} Edition` : ''}
        </div>
      </div>

      {/* Content rows — fill remaining space */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} style={row.type === 'pair' ? { display: 'flex', gap: 8, flex: 1 } : { flex: 1 }}>
            {row.type === 'full' ? (
              <div style={sectionBoxStyle}>
                {renderSectionContent(row.section)}
              </div>
            ) : (
              <>
                <div style={sectionBoxStyle}>
                  {renderSectionContent(row.sections[0])}
                </div>
                <div style={sectionBoxStyle}>
                  {renderSectionContent(row.sections[1])}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 8,
        paddingTop: 6,
        borderTop: `1px solid ${COLORS.border}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.5rem', color: COLORS.textLight, fontStyle: 'italic' }}>
          Lovingly assembled for the {familyName || 'Family'} household
          {' \u00B7 '}Printed fresh every week{' \u00B7 '}Please recycle (or compost)
        </div>
      </div>
    </div>
  )
}
