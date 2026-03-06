export type Profile = {
  id: string
  email: string
  family_name: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export type HouseholdMember = {
  id: string
  user_id: string
  name: string
  age: number | null
  role: 'parent' | 'kid'
  created_at: string
}

export type PaperStatus = 'draft' | 'preview' | 'final'

export type Paper = {
  id: string
  user_id: string
  week_start: string
  status: PaperStatus
  composed_html: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export type SectionType =
  | 'this_week'
  | 'meal_plan'
  | 'chores'
  | 'coaching'
  | 'fun_zone'
  | 'brain_fuel'

export type PaperSection = {
  id: string
  paper_id: string
  section_type: SectionType
  content: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

export type MealPlanContent = {
  meals: Record<string, { breakfast?: string; lunch?: string; dinner?: string }>
}

export type ChoresContent = {
  items: Array<{ text: string; assignee: string | null }>
}

export type ThisWeekContent = {
  items: Array<{ text: string; icon?: string }>
}

export type GeneratedContent = {
  generated: boolean
  content: {
    title: string
    body: string
  }
}
