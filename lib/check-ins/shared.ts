export type CheckInVariant = 'morning' | 'evening'

export interface EmojiOption {
  id: string
  emoji: string
  label: string
  score: number
}

export const DEFAULT_EVENING_PROMPT = 'What stood out for you today?'

export const MOOD_OPTIONS: EmojiOption[] = [
  { id: 'depleted', emoji: '😔', label: 'Running on empty', score: 1 },
  { id: 'soft', emoji: '😕', label: 'Tender but okay', score: 2 },
  { id: 'steady', emoji: '🙂', label: 'Steady and present', score: 3 },
  { id: 'bright', emoji: '😄', label: 'Bright and open', score: 4 },
  { id: 'glowing', emoji: '🤩', label: 'Glowing with joy', score: 5 },
]

export const ENERGY_OPTIONS: EmojiOption[] = [
  { id: 'drained', emoji: '😴', label: 'Running on fumes', score: 1 },
  { id: 'low', emoji: '😌', label: 'Soft but tired', score: 2 },
  { id: 'steady', emoji: '🙂', label: 'Steady and grounded', score: 3 },
  { id: 'spark', emoji: '⚡️', label: 'Spark of momentum', score: 4 },
  { id: 'soaring', emoji: '🚀', label: 'Soaring with energy', score: 5 },
]

export const INTENTION_FOCUS_OPTIONS: EmojiOption[] = [
  { id: 'scattered', emoji: '😵‍💫', label: 'Still finding focus', score: 1 },
  { id: 'curious', emoji: '🤔', label: 'Curious and exploring', score: 2 },
  { id: 'aimed', emoji: '🎯', label: 'Clear on my aim', score: 3 },
  { id: 'committed', emoji: '💪', label: 'Committed to follow-through', score: 4 },
  { id: 'grounded', emoji: '🧘', label: 'Grounded and embodied', score: 5 },
]

export const DEFAULT_MOOD_ID = MOOD_OPTIONS[Math.floor(MOOD_OPTIONS.length / 2)].id
export const DEFAULT_ENERGY_ID = ENERGY_OPTIONS[Math.floor(ENERGY_OPTIONS.length / 2)].id
export const DEFAULT_INTENTION_FOCUS_ID = INTENTION_FOCUS_OPTIONS[Math.floor(INTENTION_FOCUS_OPTIONS.length / 2)].id

export const CHECK_IN_DRAFT_PREFIX = 'ifs-checkin-draft'
export const MORNING_START_HOUR = 4
export const EVENING_START_HOUR = 18

export function startHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function toLocalDateIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map((segment) => Number.parseInt(segment, 10))
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  return new Date(year, month - 1, day)
}

export function shiftIsoDate(value: string, amount: number): string {
  const date = parseIsoDate(value)
  date.setDate(date.getDate() + amount)
  return toLocalDateIso(date)
}
const emojiGroups = {
  mood: MOOD_OPTIONS,
  energy: ENERGY_OPTIONS,
  intentionFocus: INTENTION_FOCUS_OPTIONS,
}

export type EmojiGroupKey = keyof typeof emojiGroups

export function findEmojiOption(group: EmojiGroupKey, id: string): EmojiOption {
  const options = emojiGroups[group]
  return options.find((option) => option.id === id) ?? options[Math.floor(options.length / 2)]
}

export interface EmojiSelections {
  mood: string
  energy: string
  intentionFocus: string
}

export interface PartOption {
  id: string
  name: string
  emoji: string | null
}

export interface MorningContextSummary {
  id: string
  intention: string
  mindForToday: string
  parts: string[]
  emoji: {
    mood: EmojiOption
    energy: EmojiOption
    intentionFocus: EmojiOption
  }
  generatedPrompt: string
}

export interface CheckInOverviewSlot {
  status: 'completed' | 'available' | 'locked' | 'upcoming' | 'closed' | 'not_recorded'
  completed: boolean
  completedAt?: string | null
  availableAt?: string | null
}

export interface CheckInOverviewPayload {
  morning: CheckInOverviewSlot
  evening: CheckInOverviewSlot
  streak: number
}
