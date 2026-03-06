import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { styles } from './styles'
import { arrangeSections, getMealEntries, SECTION_TITLES, formatWeekDate } from './layout'
import type { PaperSection } from '@/lib/types/database'

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
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>This Week</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.thisWeekItem}>
          <Text style={styles.thisWeekIcon}>{item.icon ?? '*'}</Text>
          <Text style={styles.thisWeekText}>{item.text}</Text>
        </View>
      ))}
    </View>
  )
}

function ChoresSection({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<{ text: string; assignee?: string | null }>) ?? []
  if (items.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>Weekly Chores</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.choreItem}>
          <View style={styles.checkbox} />
          <Text style={styles.choreText}>{item.text}</Text>
          {item.assignee && (
            <Text style={styles.choreAssignee}>({item.assignee})</Text>
          )}
        </View>
      ))}
    </View>
  )
}

function MealPlanSection({ content }: { content: Record<string, unknown> }) {
  const entries = getMealEntries(content)
  if (entries.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>Meal Plan</Text>
      {entries.map((entry, i) => (
        <View key={i} style={styles.mealRow}>
          <Text style={styles.mealDay}>{entry.day}</Text>
          <Text style={styles.mealText}>{entry.description}</Text>
        </View>
      ))}
    </View>
  )
}

function GeneratedSection({ title, content }: { title: string; content: Record<string, unknown> }) {
  const inner = content.content as { title?: string; body?: string } | undefined
  if (!inner?.body) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {inner.title && <Text style={styles.generatedTitle}>{inner.title}</Text>}
      <Text style={styles.generatedBody}>{inner.body}</Text>
    </View>
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

// --- Main document ---

export function NewsletterDocument({ familyName, weekStart, sections, issueNumber }: Props) {
  const { topSections, midSections, bottomSections } = arrangeSections(sections)
  const dateStr = formatWeekDate(weekStart)

  return (
    <Document title={`Poopin' Papers - ${familyName}`} author="Poopin' Papers">
      <Page size="LETTER" style={styles.page} wrap={false}>
        <View style={styles.masthead}>
          <Text style={styles.mastheadTitle}>Poopin&apos; Papers</Text>
          <Text style={styles.mastheadTagline}>
            Your weekly digest of household happenings, crafted with care
          </Text>
          <Text style={styles.mastheadDate}>
            Week of {dateStr}
            {issueNumber ? ` \u00B7 Issue #${issueNumber}` : ''}
            {familyName ? ` \u00B7 ${familyName} Edition` : ''}
          </Text>
        </View>

        <View style={styles.content}>
          {topSections.map((s) => (
            <React.Fragment key={s.id}>{renderSection(s)}</React.Fragment>
          ))}
          {midSections.length > 0 && (
            <View style={styles.row}>
              {midSections.map((s) => (
                <React.Fragment key={s.id}>{renderSection(s)}</React.Fragment>
              ))}
            </View>
          )}
          {bottomSections.length > 0 && (
            <View style={styles.row}>
              {bottomSections.map((s) => (
                <React.Fragment key={s.id}>{renderSection(s)}</React.Fragment>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Lovingly assembled for the {familyName || 'Family'} household
            {' \u00B7 '}Printed fresh every week{' \u00B7 '}Please recycle (or compost)
          </Text>
        </View>
      </Page>
    </Document>
  )
}
