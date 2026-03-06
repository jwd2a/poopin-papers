import { StyleSheet, Font } from '@react-pdf/renderer'

// Disable default hyphenation (causes weird word breaks)
Font.registerHyphenationCallback((word) => [word])

// 72pt = 1in. Letter = 612x792pt. 0.5in padding = 36pt.
// Live area: 540pt wide x 720pt tall.
const COLORS = {
  text: '#292524',
  textMuted: '#44403c',
  textLight: '#78716c',
  cream: '#fffbeb',
  amber: '#fef3c7',
  border: '#d6d3d1',
  borderDark: '#a8a29e',
}

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 10,
    color: COLORS.text,
    padding: 36, // 0.5in
    display: 'flex',
    flexDirection: 'column',
  },

  // Masthead
  masthead: {
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.borderDark,
    borderBottomStyle: 'solid',
  },
  mastheadTitle: {
    fontSize: 28,
    fontFamily: 'Times-Bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  mastheadTagline: {
    fontSize: 9,
    fontFamily: 'Times-Italic',
    color: COLORS.textLight,
    marginBottom: 3,
  },
  mastheadDate: {
    fontSize: 8,
    fontFamily: 'Times-Bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Content area — fills remaining space
  content: {
    flex: 1,
    gap: 6,
  },

  // Row for side-by-side sections
  row: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },

  // Section wrapper
  section: {
    flex: 1,
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 3,
    padding: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
    textTransform: 'uppercase',
    color: COLORS.text,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: 'solid',
  },
  sectionBody: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLORS.textMuted,
  },

  // This Week items
  thisWeekItem: {
    flexDirection: 'row',
    marginBottom: 3,
    gap: 4,
  },
  thisWeekIcon: {
    fontSize: 9,
    width: 14,
  },
  thisWeekText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.4,
    color: COLORS.textMuted,
  },

  // Chores
  choreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 5,
  },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
    borderStyle: 'solid',
    borderRadius: 1,
  },
  choreText: {
    flex: 1,
    fontSize: 9.5,
    color: COLORS.textMuted,
  },
  choreAssignee: {
    fontSize: 8,
    color: COLORS.textLight,
    fontFamily: 'Times-Italic',
  },

  // Meal plan
  mealRow: {
    flexDirection: 'row',
    marginBottom: 2,
    gap: 4,
  },
  mealDay: {
    width: 55,
    fontSize: 9,
    fontFamily: 'Times-Bold',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  mealText: {
    flex: 1,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  // Generated content (coaching, fun zone, brain fuel)
  generatedTitle: {
    fontSize: 10,
    fontFamily: 'Times-Bold',
    color: COLORS.text,
    marginBottom: 3,
  },
  generatedBody: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLORS.textMuted,
  },

  // Footer
  footer: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderTopStyle: 'solid',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textLight,
    fontFamily: 'Times-Italic',
    textAlign: 'center',
  },
})

export { COLORS }
