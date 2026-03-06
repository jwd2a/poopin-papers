import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { styles } from './styles'
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
  const meals = content.meals as Record<string, Record<string, string>> | undefined
  if (!meals) return null

  const entries: Array<{ day: string; description: string }> = []
  for (const [day, dayMeals] of Object.entries(meals)) {
    const parts = Object.entries(dayMeals)
      .filter(([, meal]) => meal && meal.trim())
      .map(([, meal]) => meal)
    if (parts.length > 0) {
      entries.push({ day, description: parts.join(', ') })
    }
  }
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

function GeneratedSection({
  title,
  content,
}: {
  title: string
  content: Record<string, unknown>
}) {
  const inner = content.content as { title?: string; body?: string } | undefined
  if (!inner?.body) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {inner.title && (
        <Text style={styles.generatedTitle}>{inner.title}</Text>
      )}
      <Text style={styles.generatedBody}>{inner.body}</Text>
    </View>
  )
}

// --- Layout logic ---

const SECTION_TITLES: Record<string, string> = {
  coaching: 'Coaching Corner',
  fun_zone: 'Fun Zone',
  brain_fuel: 'Brain Fuel',
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

function isSectionEmpty(section: PaperSection): boolean {
  const content = section.content as Record<string, unknown>

  if (section.section_type === 'meal_plan') {
    const meals = content.meals as Record<string, Record<string, string>> | undefined
    if (!meals) return true
    return Object.values(meals).every((day) =>
      Object.values(day).every((meal) => !meal || meal.trim() === '')
    )
  }
  if (section.section_type === 'this_week' || section.section_type === 'chores') {
    const items = content.items as unknown[] | undefined
    return !items || items.length === 0
  }
  if (['coaching', 'fun_zone', 'brain_fuel'].includes(section.section_type)) {
    if (content.generated === false) return true
    const inner = content.content as { title?: string; body?: string } | undefined
    return !inner?.body
  }
  return false
}

// Arrange sections into rows for a newspaper-style layout
function arrangeSections(sections: PaperSection[]) {
  const live = sections.filter((s) => s.enabled && !isSectionEmpty(s))

  const topSections: PaperSection[] = []
  const midSections: PaperSection[] = []
  const bottomSections: PaperSection[] = []

  for (const s of live) {
    if (s.section_type === 'this_week' || s.section_type === 'meal_plan') {
      topSections.push(s)
    } else if (s.section_type === 'chores') {
      midSections.unshift(s)
    } else {
      if (midSections.length < 2) {
        midSections.push(s)
      } else {
        bottomSections.push(s)
      }
    }
  }

  return { topSections, midSections, bottomSections }
}

// --- Main document ---

export function NewsletterDocument({ familyName, weekStart, sections, issueNumber }: Props) {
  const { topSections, midSections, bottomSections } = arrangeSections(sections)
  const dateStr = new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Document title={`Poopin' Papers - ${familyName}`} author="Poopin' Papers">
      <Page size="LETTER" style={styles.page} wrap={false}>
        {/* Masthead */}
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

        {/* Content */}
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

        {/* Footer */}
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
