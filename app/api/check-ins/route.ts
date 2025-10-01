import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { getServiceClient, getUserClient } from '@/lib/supabase/clients'
import { dev, resolveUserId } from '@/config/dev'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'

const DEFAULT_EVENING_PROMPT = 'What stood out for you today?'

interface EmojiOption {
  id: string
  emoji: string
  label: string
  score: number
}

const MOOD_OPTIONS: EmojiOption[] = [
  { id: 'depleted', emoji: '😔', label: 'Running on empty', score: 1 },
  { id: 'soft', emoji: '😕', label: 'Tender but okay', score: 2 },
  { id: 'steady', emoji: '🙂', label: 'Steady and present', score: 3 },
  { id: 'bright', emoji: '😄', label: 'Bright and open', score: 4 },
  { id: 'glowing', emoji: '🤩', label: 'Glowing with joy', score: 5 },
]

const ENERGY_OPTIONS: EmojiOption[] = [
  { id: 'drained', emoji: '😴', label: 'Running on fumes', score: 1 },
  { id: 'low', emoji: '😌', label: 'Soft but tired', score: 2 },
  { id: 'steady', emoji: '🙂', label: 'Steady and grounded', score: 3 },
  { id: 'spark', emoji: '⚡️', label: 'Spark of momentum', score: 4 },
  { id: 'soaring', emoji: '🚀', label: 'Soaring with energy', score: 5 },
]

const INTENTION_FOCUS_OPTIONS: EmojiOption[] = [
  { id: 'scattered', emoji: '😵‍💫', label: 'Still finding focus', score: 1 },
  { id: 'curious', emoji: '🤔', label: 'Curious and exploring', score: 2 },
  { id: 'aimed', emoji: '🎯', label: 'Clear on my aim', score: 3 },
  { id: 'committed', emoji: '💪', label: 'Committed to follow-through', score: 4 },
  { id: 'grounded', emoji: '🧘', label: 'Grounded and embodied', score: 5 },
]

const emojiGroups = {
  mood: MOOD_OPTIONS,
  energy: ENERGY_OPTIONS,
  intentionFocus: INTENTION_FOCUS_OPTIONS,
}

type EmojiGroupKey = keyof typeof emojiGroups

const morningSchema = z.object({
  type: z.literal('morning'),
  mood: z.string(),
  energy: z.string(),
  intentionFocus: z.string(),
  mindForToday: z.string().optional(),
  intention: z.string().min(1, 'Intention is required'),
  parts: z.array(z.string()).optional(),
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
})

function findEmojiOption(group: EmojiGroupKey, id: string): EmojiOption {
  const options = emojiGroups[group]
  return options.find((option) => option.id === id) ?? options[Math.floor(options.length / 2)]
}

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

export async function POST(req: NextRequest) {
  const useAdmin = dev.enabled && !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = useAdmin ? getServiceClient() : getUserClient()

  let effectiveUserId: string | null = null

  if (useAdmin) {
    try {
      effectiveUserId = resolveUserId()
    } catch {
      return errorResponse(
        'Dev user not configured. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID.',
        HTTP_STATUS.BAD_REQUEST,
      )
    }
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
    }
    effectiveUserId = user.id
  }

  try {
    const json = await req.json()

    if (!json?.type || (json.type !== 'morning' && json.type !== 'evening')) {
      return errorResponse('Invalid check-in type', HTTP_STATUS.BAD_REQUEST)
    }

    if (json.type === 'morning') {
      const parsed = morningSchema.safeParse(json)
      if (!parsed.success) {
        return errorResponse('Invalid check-in payload', HTTP_STATUS.BAD_REQUEST)
      }

      const payload = parsed.data
      const mood = findEmojiOption('mood', payload.mood)
      const energy = findEmojiOption('energy', payload.energy)
      const intentionFocus = findEmojiOption('intentionFocus', payload.intentionFocus)

      const prompt = await generateEveningPrompt({
        intention: payload.intention,
        mindForToday: payload.mindForToday ?? '',
        mood,
        energy,
        intentionFocus,
      })

      const createdAt = new Date().toISOString()
      const selectedParts = payload.parts ?? []

      const partsData: Record<string, unknown> = {
        selected_part_ids: selectedParts,
        daily_responses: {
          variant: 'morning',
          emoji: buildEmojiSnapshot({ mood, energy, intentionFocus }),
          mindForToday: payload.mindForToday ?? '',
          intention: payload.intention,
          selectedPartIds: selectedParts,
          generatedEveningPrompt: {
            text: prompt.text,
            created_at: createdAt,
            ...(prompt.model ? { model: prompt.model } : {}),
          },
        },
      }

      const { error, data } = await supabase
        .from('check_ins')
        .insert({
          user_id: effectiveUserId,
          type: 'morning',
          mood: mood.score,
          energy_level: energy.score,
          intention: payload.intention,
          parts_data: partsData,
          somatic_markers: null,
          gratitude: null,
          reflection: null,
        })
        .select()

      if (error) {
        console.error('Error inserting morning check-in:', error)
        const pgCode = (error as { code?: string } | null)?.code
        if (pgCode === '23505') {
          return errorResponse('A check-in of this type already exists for this date.', HTTP_STATUS.CONFLICT)
        }
        return errorResponse('Failed to save check-in', HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }

      return jsonResponse(data ?? [], HTTP_STATUS.CREATED)
    }

    const parsed = eveningSchema.safeParse(json)
    if (!parsed.success) {
      return errorResponse('Invalid check-in payload', HTTP_STATUS.BAD_REQUEST)
    }

    const payload = parsed.data
    const mood = findEmojiOption('mood', payload.mood)
    const energy = findEmojiOption('energy', payload.energy)
    const intentionFocus = findEmojiOption('intentionFocus', payload.intentionFocus)
    const reflectionPrompt = payload.reflectionPrompt.trim() || DEFAULT_EVENING_PROMPT
    const selectedParts = payload.parts ?? []
    const gratitude = payload.gratitude?.trim() ?? ''
    const moreNotes = payload.moreNotes?.trim() ?? ''

    const today = new Date().toISOString().slice(0, 10)

    const { data: morningRows } = await supabase
      .from('check_ins')
      .select('id, parts_data')
      .eq('user_id', effectiveUserId)
      .eq('type', 'morning')
      .eq('check_in_date', today)
      .order('created_at', { ascending: false })
      .limit(1)

    const morningRecord = morningRows && morningRows.length > 0 ? morningRows[0] : null

    const partsData: Record<string, unknown> = {
      selected_part_ids: selectedParts,
      daily_responses: {
        variant: 'evening',
        emoji: buildEmojiSnapshot({ mood, energy, intentionFocus }),
        reflectionPrompt: { text: reflectionPrompt },
        reflection: payload.reflection.trim(),
        gratitude,
        moreNotes,
        selectedPartIds: selectedParts,
        ...(morningRecord?.id ? { links: { morning_check_in_id: morningRecord.id } } : {}),
      },
    }

    const { error, data } = await supabase
      .from('check_ins')
      .insert({
        user_id: effectiveUserId,
        type: 'evening',
        mood: mood.score,
        energy_level: energy.score,
        reflection: payload.reflection.trim(),
        gratitude: gratitude.length > 0 ? gratitude : null,
        intention: null,
        parts_data: partsData,
        somatic_markers: null,
      })
      .select()

    if (error) {
      console.error('Error inserting evening check-in:', error)
      const pgCode = (error as { code?: string } | null)?.code
      if (pgCode === '23505') {
        return errorResponse('A check-in of this type already exists for this date.', HTTP_STATUS.CONFLICT)
      }
      return errorResponse('Failed to save check-in', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    if (morningRecord) {
      try {
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

        await supabase
          .from('check_ins')
          .update({ parts_data: updatedMorningPartsData })
          .eq('id', morningRecord.id as string)
      } catch (updateError) {
        console.error('Failed to update morning check-in with evening status', updateError)
      }
    }

    return jsonResponse(data ?? [], HTTP_STATUS.CREATED)
  } catch (error) {
    console.error('Check-in API error:', error)
    return errorResponse('An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
