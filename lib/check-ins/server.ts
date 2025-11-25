import { z } from 'zod'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { dev, resolveUserId } from '@/config/dev'
import { getServiceClient, getUserClient } from '@/lib/supabase/clients'
import { enqueueMemoryUpdate } from '@/lib/memory/queue'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import type { CheckInRow } from '@/lib/types/database'
import { listPartDisplayRecords } from '@/lib/data/schema/server'
import type { PrdServerDeps } from '@/lib/data/schema/server'
import {
  DEFAULT_EVENING_PROMPT,
  ENERGY_OPTIONS,
  INTENTION_FOCUS_OPTIONS,
  MOOD_OPTIONS,
  findEmojiOption,
  type CheckInOverviewPayload,
  type CheckInOverviewSlot,
  type MorningContextSummary,
  type PartOption,
  type EmojiOption,
  MORNING_START_HOUR,
  EVENING_START_HOUR,
  startHourLabel,
  toLocalDateIso,
  parseIsoDate,
  shiftIsoDate,
  getCurrentHourInTimezone,
  isValidTimezone,
} from './shared'
import type { UserSettings } from '@/lib/types/database'

interface SubmissionBase {
  targetDateIso?: string
}

export interface MorningSubmissionPayload extends SubmissionBase {
  type: 'morning'
  mood: string
  energy: string
  intentionFocus: string
  mindForToday?: string
  intention: string
  parts?: string[]
}

export interface EveningSubmissionPayload extends SubmissionBase {
  type: 'evening'
  mood: string
  energy: string
  intentionFocus: string
  reflectionPrompt: string
  reflection: string
  gratitude?: string
  moreNotes?: string
  parts?: string[]
}

export type CheckInSubmissionPayload = MorningSubmissionPayload | EveningSubmissionPayload

export interface SubmissionResult {
  data: CheckInRow[]
  conflict: boolean
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const morningSchema = z.object({
  type: z.literal('morning'),
  mood: z.string(),
  energy: z.string(),
  intentionFocus: z.string(),
  mindForToday: z.string().optional(),
  intention: z.string().min(1, 'Intention is required'),
  parts: z.array(z.string()).optional(),
  targetDateIso: isoDateSchema.optional(),
})

const eveningSchema = z.object({
  type: z.literal('evening'),
  mood: z.string(),
  energy: z.string(),
  intentionFocus: z.string(),
  reflectionPrompt: z.string().min(1),
  reflection: z.string().min(1),
  gratitude: z.string().optional(),
  moreNotes: z.string().optional(),
  parts: z.array(z.string()).optional(),
  targetDateIso: isoDateSchema.optional(),
})

function buildEmojiSnapshot(payload: {
  mood: EmojiOption
  energy: EmojiOption
  intentionFocus: EmojiOption
}) {
  return {
    mood: payload.mood,
    energy: payload.energy,
    intentionFocus: payload.intentionFocus,
  }
}

async function generateEveningPrompt(params: {
  intention: string
  mindForToday: string
  mood: EmojiOption
  energy: EmojiOption
  intentionFocus: EmojiOption
}): Promise<{ text: string; model?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { text: DEFAULT_EVENING_PROMPT }
  }

  try {
    const provider = createOpenRouter({ apiKey })
    const schema = z.object({ prompt: z.string().min(1).max(180) })

    const system = `You are a gentle IFS-inspired companion helping the user reflect in the evening.
Craft a short, supportive, curiosity-driven reflection prompt (1-2 sentences maximum) that references the user's morning check-in.
Keep it grounded, avoid clinical language, and never promise outcomes.`

    const promptLines = [
      `Morning intention: ${params.intention || 'Not specified.'}`,
      `Morning mindshare: ${params.mindForToday || 'Not specified.'}`,
      `Mood: ${params.mood.label}.`,
      `Energy: ${params.energy.label}.`,
      `Intention focus: ${params.intentionFocus.label}.`,
    ]

    const { object } = await generateObject({
      model: provider('openai/gpt-4o-mini'),
      system,
      schema,
      prompt: promptLines.join('\n'),
    })

    const text = object.prompt.trim()
    if (!text) {
      return { text: DEFAULT_EVENING_PROMPT }
    }

    return { text, model: 'openai/gpt-4o-mini' }
  } catch (error) {
    console.error('Failed to generate evening prompt', error)
    return { text: DEFAULT_EVENING_PROMPT }
  }
}

async function resolveContextClient(): Promise<{ supabase: SupabaseDatabaseClient; userId: string }> {
  const useAdmin = dev.enabled && !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = useAdmin ? getServiceClient() : await getUserClient()

  if (useAdmin) {
    try {
      const userId = resolveUserId()
      return { supabase, userId }
    } catch {
      throw new Error('Dev user not configured. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID.')
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error('Failed to resolve user for check-in context', error)
    throw new Error('Unable to resolve user session')
  }

  if (!user) {
    throw new Error('Unauthorized')
  }

  return { supabase, userId: user.id }
}

export async function loadAvailableParts(): Promise<PartOption[]> {
  const { supabase, userId } = await resolveContextClient()

  try {
    const partsDisplay = await listPartDisplayRecords(
      { client: supabase as PrdServerDeps['client'], userId },
      null, // fetch all parts (no limit) for check-in picker
    )
    return partsDisplay.map((row) => ({
      id: row.id,
      name: row.display_name || row.name || 'Unnamed Part',
      emoji: row.emoji,
    }))
  } catch (error) {
    console.error('Failed to load parts for check-in using PRD schema', error)
    return []
  }
}

export async function loadMorningContext(targetDateIso: string): Promise<MorningContextSummary | null> {
  const { supabase, userId } = await resolveContextClient()

  const { data, error } = await supabase
    .from('check_ins')
    .select('id, intention, parts_data, created_at')
    .eq('user_id', userId)
    .eq('type', 'morning')
    .eq('check_in_date', targetDateIso)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Failed to load morning check-in context', error)
    return null
  }

  if (!data || data.length === 0) {
    return null
  }

  const record = data[0]
  const partsData = (record.parts_data as Record<string, unknown> | null) ?? null
  const rawResponses =
    partsData && typeof partsData === 'object'
      ? (partsData as { daily_responses?: unknown }).daily_responses
      : undefined
  const storedResponses =
    rawResponses && typeof rawResponses === 'object'
      ? (rawResponses as Record<string, unknown> & { variant?: 'morning' | 'evening' })
      : undefined
  const responses =
    storedResponses && (!storedResponses.variant || storedResponses.variant === 'morning')
      ? storedResponses
      : undefined

  const emojiRecord =
    responses && typeof responses.emoji === 'object' && responses.emoji !== null
      ? (responses.emoji as Record<string, unknown>)
      : undefined

  const intention =
    typeof responses?.intention === 'string'
      ? responses.intention
      : typeof record.intention === 'string'
      ? record.intention
      : ''
  const mindForToday = typeof responses?.mindForToday === 'string' ? responses.mindForToday : ''
  const topLevelSelected = Array.isArray((partsData as { selected_part_ids?: unknown })?.selected_part_ids)
    ? (((partsData as { selected_part_ids?: unknown }).selected_part_ids as unknown[]) || []).filter(
        (id): id is string => typeof id === 'string',
      )
    : []
  const parts = Array.isArray(responses?.selectedPartIds)
    ? (responses?.selectedPartIds.filter((id) => typeof id === 'string') as string[])
    : topLevelSelected
  const generatedPrompt =
    responses && typeof responses.generatedEveningPrompt === 'object'
      ? ((responses.generatedEveningPrompt as { text?: unknown }).text as string | undefined)
      : undefined

  const moodSelection =
    emojiRecord && typeof (emojiRecord.mood as { id?: unknown } | undefined)?.id === 'string'
      ? (emojiRecord.mood as { id: string }).id
      : MOOD_OPTIONS[Math.floor(MOOD_OPTIONS.length / 2)].id
  const energySelection =
    emojiRecord && typeof (emojiRecord.energy as { id?: unknown } | undefined)?.id === 'string'
      ? (emojiRecord.energy as { id: string }).id
      : ENERGY_OPTIONS[Math.floor(ENERGY_OPTIONS.length / 2)].id
  const intentionFocusSelection =
    emojiRecord && typeof (emojiRecord.intentionFocus as { id?: unknown } | undefined)?.id === 'string'
      ? (emojiRecord.intentionFocus as { id: string }).id
      : INTENTION_FOCUS_OPTIONS[Math.floor(INTENTION_FOCUS_OPTIONS.length / 2)].id

  const moodOption = findEmojiOption('mood', moodSelection)
  const energyOption = findEmojiOption('energy', energySelection)
  const intentionFocusOption = findEmojiOption('intentionFocus', intentionFocusSelection)

  return {
    id: record.id as string,
    intention,
    mindForToday,
    parts,
    emoji: {
      mood: moodOption,
      energy: energyOption,
      intentionFocus: intentionFocusOption,
    },
    generatedPrompt: generatedPrompt && generatedPrompt.length > 0 ? generatedPrompt : DEFAULT_EVENING_PROMPT,
  }
}

export async function submitCheckIn(payload: CheckInSubmissionPayload): Promise<SubmissionResult> {
  const { supabase, userId } = await resolveContextClient()

  if (payload.type === 'morning') {
    const parsed = morningSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error('Invalid check-in payload')
    }

    const data = parsed.data
    const targetDateIso = resolveTargetDate(data.targetDateIso)
    const mood = findEmojiOption('mood', data.mood)
    const energy = findEmojiOption('energy', data.energy)
    const intentionFocus = findEmojiOption('intentionFocus', data.intentionFocus)

    const prompt = await generateEveningPrompt({
      intention: data.intention,
      mindForToday: data.mindForToday ?? '',
      mood,
      energy,
      intentionFocus,
    })

    const createdAt = new Date().toISOString()
    const selectedParts = data.parts ?? []

    const partsData: Record<string, unknown> = {
      selected_part_ids: selectedParts,
      daily_responses: {
        variant: 'morning',
        emoji: buildEmojiSnapshot({ mood, energy, intentionFocus }),
        mindForToday: data.mindForToday ?? '',
        intention: data.intention,
        selectedPartIds: selectedParts,
        generatedEveningPrompt: {
          text: prompt.text,
          created_at: createdAt,
          ...(prompt.model ? { model: prompt.model } : {}),
        },
      },
    }

    const { error, data: inserted } = await supabase
      .from('check_ins')
      .insert({
        user_id: userId,
        type: 'morning',
        check_in_date: targetDateIso,
        mood: mood.score,
        energy_level: energy.score,
        intention: data.intention,
        gratitude: null,
        reflection: null,
        somatic_markers: [],
        parts_data: partsData,
      })
      .select()

    if (error) {
      const pgCode = (error as { code?: string } | null)?.code
      if (pgCode === '23505') {
        return { data: inserted ?? [], conflict: true }
      }
      console.error('Error inserting morning check-in:', error)
      throw new Error('Failed to save check-in')
    }

    const record = Array.isArray(inserted) && inserted.length > 0 ? (inserted[0] as CheckInRow) : null
    if (record?.id) {
      const enqueueResult = await enqueueMemoryUpdate({
        userId,
        kind: 'check_in',
        refId: record.id,
        payload: {
          checkInId: record.id,
          variant: 'morning',
          date: targetDateIso,
        },
        metadata: { source: 'check_in', variant: 'morning' },
      })
      if (!enqueueResult.inserted && enqueueResult.error) {
        console.warn('[check-ins] failed to enqueue morning memory update', {
          userId,
          checkInId: record.id,
          error: enqueueResult.error,
        })
      }
    }

    return { data: inserted ?? [], conflict: false }
  }

  const parsed = eveningSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error('Invalid check-in payload')
  }

  const data = parsed.data
  const targetDateIso = resolveTargetDate(data.targetDateIso)
  const mood = findEmojiOption('mood', data.mood)
  const energy = findEmojiOption('energy', data.energy)
  const intentionFocus = findEmojiOption('intentionFocus', data.intentionFocus)
  const reflectionPrompt = data.reflectionPrompt.trim() || DEFAULT_EVENING_PROMPT
  const selectedParts = data.parts ?? []
  const gratitude = data.gratitude?.trim() ?? ''
  const moreNotes = data.moreNotes?.trim() ?? ''

  const { data: morningRows } = await supabase
    .from('check_ins')
    .select('id, parts_data')
    .eq('user_id', userId)
    .eq('type', 'morning')
    .eq('check_in_date', targetDateIso)
    .order('created_at', { ascending: false })
    .limit(1)

  const morningRecord = morningRows && morningRows.length > 0 ? morningRows[0] : null

  const partsData: Record<string, unknown> = {
    selected_part_ids: selectedParts,
    daily_responses: {
      variant: 'evening',
      emoji: buildEmojiSnapshot({ mood, energy, intentionFocus }),
      reflectionPrompt: { text: reflectionPrompt },
      reflection: data.reflection.trim(),
      gratitude,
      moreNotes,
      selectedPartIds: selectedParts,
      ...(morningRecord?.id ? { links: { morning_check_in_id: morningRecord.id } } : {}),
    },
  }

  const { error, data: inserted } = await supabase
    .from('check_ins')
    .insert({
      user_id: userId,
      type: 'evening',
      check_in_date: targetDateIso,
      mood: mood.score,
      energy_level: energy.score,
      reflection: data.reflection.trim(),
      gratitude: gratitude.length > 0 ? gratitude : null,
      intention: null,
      parts_data: partsData,
      somatic_markers: [],
    })
    .select()

  if (error) {
    const pgCode = (error as { code?: string } | null)?.code
    if (pgCode === '23505') {
      return { data: inserted ?? [], conflict: true }
    }
    console.error('Error inserting evening check-in:', error)
    throw new Error('Failed to save check-in')
  }

  const eveningRecord = Array.isArray(inserted) && inserted.length > 0 ? (inserted[0] as CheckInRow) : null
  if (eveningRecord?.id) {
    const enqueueResult = await enqueueMemoryUpdate({
      userId,
      kind: 'check_in',
      refId: eveningRecord.id,
      payload: {
        checkInId: eveningRecord.id,
        variant: 'evening',
        date: targetDateIso,
      },
      metadata: { source: 'check_in', variant: 'evening' },
    })
    if (!enqueueResult.inserted && enqueueResult.error) {
      console.warn('[check-ins] failed to enqueue evening memory update', {
        userId,
        checkInId: eveningRecord.id,
        error: enqueueResult.error,
      })
    }
  }

  if (morningRecord) {
    const existingPartsData = (morningRecord.parts_data as Record<string, unknown> | null) ?? {}
    const existingDaily =
      existingPartsData && typeof existingPartsData === 'object'
        ? ((existingPartsData as { daily_responses?: unknown }).daily_responses as
            | Record<string, unknown>
            | undefined)
        : undefined

    const existingPrompt =
      existingDaily && typeof existingDaily === 'object' && existingDaily !== null
        ? ((existingDaily as { generatedEveningPrompt?: unknown }).generatedEveningPrompt as
            | Record<string, unknown>
            | undefined)
        : undefined

    const updatedMorningPartsData = {
      ...existingPartsData,
      daily_responses: {
        ...(existingDaily ?? {}),
        generatedEveningPrompt: {
          ...(existingPrompt ?? {}),
          responded_at: new Date().toISOString(),
        },
      },
    }

    const { error: updateError } = await supabase
      .from('check_ins')
      .update({ parts_data: updatedMorningPartsData })
      .eq('id', morningRecord.id as string)

    if (updateError) {
      console.error('Failed to update morning check-in with evening status', updateError)
    }
  }

  return { data: inserted ?? [], conflict: false }
}

export async function loadCheckInOverview(
  targetDateIso: string,
  timezone?: string,
): Promise<CheckInOverviewPayload> {
  const { supabase, userId } = await resolveContextClient()
  const normalizedTargetIso = resolveTargetDate(targetDateIso)

  // Fetch user timezone if not provided
  let userTimezone = timezone
  if (!userTimezone) {
    const { data: user } = await supabase
      .from('users')
      .select('settings')
      .eq('id', userId)
      .single()
    userTimezone = (user?.settings as UserSettings | null)?.timezone ?? 'America/New_York'
  }

  // Validate timezone and fallback if invalid
  if (!isValidTimezone(userTimezone)) {
    console.warn(`Invalid timezone: ${userTimezone}, falling back to America/New_York`)
    userTimezone = 'America/New_York'
  }

  const { data, error } = await supabase
    .from('check_ins')
    .select('type, created_at, check_in_date')
    .eq('user_id', userId)
    .gte('check_in_date', shiftIsoDate(normalizedTargetIso, -60))
    .lte('check_in_date', normalizedTargetIso)
    .order('check_in_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load check-in overview', error)
    return {
      morning: { status: 'not_recorded', completed: false },
      evening: { status: 'not_recorded', completed: false },
      streak: 0,
    }
  }

  const targetDate = normalizedTargetIso
  const todayIso = toLocalDateIso(new Date())
  const isViewingToday = targetDate === todayIso
  const hour = getCurrentHourInTimezone(userTimezone)

  const entries = data ?? []
  const hasMorning = entries.some((row) => row.check_in_date === targetDate && row.type === 'morning')
  const hasEvening = entries.some((row) => row.check_in_date === targetDate && row.type === 'evening')

  const morningStatus: CheckInOverviewSlot['status'] = (() => {
    if (hasMorning) return 'completed'
    if (!isViewingToday) return 'not_recorded'
    if (hour < MORNING_START_HOUR) return 'upcoming'
    if (hour >= EVENING_START_HOUR) return 'closed'
    return 'available'
  })()

  const eveningStatus: CheckInOverviewSlot['status'] = (() => {
    if (hasEvening) return 'completed'
    if (!isViewingToday) return 'not_recorded'
    if (hour < EVENING_START_HOUR) return 'locked'
    return 'available'
  })()

  const streak = computeStreak(entries, normalizedTargetIso)

  return {
    morning: {
      status: morningStatus,
      completed: morningStatus === 'completed',
      availableAt: startHourLabel(MORNING_START_HOUR),
    },
    evening: {
      status: eveningStatus,
      completed: eveningStatus === 'completed',
      availableAt: startHourLabel(EVENING_START_HOUR),
    },
    streak,
  }
}

function computeStreak(entries: Array<{ check_in_date: string }>, targetDateIso: string): number {
  if (!entries.length) return 0

  const dates = new Set(entries.map((entry) => entry.check_in_date))
  let streak = 0
  let cursor = targetDateIso

  while (dates.has(cursor)) {
    streak += 1
    cursor = shiftIsoDate(cursor, -1)
  }

  return streak
}

function resolveTargetDate(value?: string): string {
  if (!value) {
    return toLocalDateIso(new Date())
  }

  try {
    return toLocalDateIso(parseIsoDate(value))
  } catch {
    return toLocalDateIso(new Date())
  }
}

export {
  morningSchema as morningSubmissionSchema,
  eveningSchema as eveningSubmissionSchema,
  findEmojiOption,
  buildEmojiSnapshot,
}
