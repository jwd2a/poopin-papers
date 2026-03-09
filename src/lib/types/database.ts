export type Audience = 'toddlers' | 'kids' | 'pre-teens' | 'teens' | 'adults'

export type Profile = {
  id: string
  email: string
  family_name: string | null
  timezone: string
  audience: Audience[]
  intranet_url: string | null
  is_admin: boolean
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
  overridden: boolean
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

export type EditionStatus = 'draft' | 'approved' | 'published'

export type WeeklyEdition = {
  id: string
  week_start: string
  sections: {
    coaching?: { title: string; body: string }
    fun_zone?: { title: string; body: string }
    brain_fuel?: { title: string; body: string; riddle_answer?: string }
    this_week?: { items: Array<{ text: string; icon?: string }> }
  }
  composed_html: string | null
  issue_number: number
  status: EditionStatus
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

export type GeneratedContent = {
  generated: boolean
  content: {
    title: string
    body: string
  }
}
