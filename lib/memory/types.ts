export type Primitive = string | number

export type DatumValue = Primitive | Primitive[]

export type UserMemory = {
  version: number
  last_updated_by: string
  summary: string
  parts: Record<string, {
    name: string
    status: 'active' | 'acknowledged' | 'inactive' | string
    recency_score?: number
    influence_score?: number
    goals?: Array<{ goal: string }>
  }>
  triggers_and_goals: Array<{
    trigger: string
    desired_outcome: string
    related_parts: string[]
  }>
  safety_notes?: string
}

export const INITIAL_USER_MEMORY: UserMemory = {
  version: 1,
  last_updated_by: 'system',
  summary: 'Initial user memory. No observations yet.',
  parts: {},
  triggers_and_goals: [],
  safety_notes: ''
}

