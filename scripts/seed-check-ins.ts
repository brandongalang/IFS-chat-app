#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { TEST_PERSONAS, type TestPersona, getPersonaUserId } from '../config/personas'

const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

type Args = { days: number; confirm: boolean }

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const get = (f: string) => {
    const i = args.indexOf(f)
    return i >= 0 ? args[i + 1] : undefined
  }
  const days = parseInt(get('--days') || '14', 10)
  const ok = args.includes('--confirm') && (get('--confirm') || '').toLowerCase() === 'seed checkins'
  if (!ok) throw new Error('Must include --confirm "seed checkins"')
  return { days, confirm: true }
}

function assertSafety() {
  if (process.env.IFS_DEV_MODE !== 'true') {
    throw new Error('IFS_DEV_MODE must be true to run check-ins seeding')
  }
  const isStaging = process.env.TARGET_ENV === 'staging'
  const url = isStaging ? process.env.STAGING_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = isStaging ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase URL or Service Role Key')
  return { url, serviceKey }
}

function toDateUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function asISODate(d: Date) { return d.toISOString().slice(0, 10) }

function pick<T>(arr: T[], idx: number) { return arr[idx % arr.length] }

type EmojiOption = {
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

const DEFAULT_PROMPT = 'What stood out for you today?'

const AM_NOTES = [
  'Set an intention to stay curious with parts.',
  'Notice sensations before diving into tasks.',
  'Invite a gentle pace and self-trust.'
]
const AM_CONTEXTS = [
  'Preparing for a collaborative sync with the team.',
  'Holding space for a vulnerable conversation later today.',
  'Creating focus for deep work without rushing.',
]
const PM_NOTES = [
  'Reflected on protector showing up after feedback.',
  'Grateful for small moments of ease.',
  'Saw a pattern and noted it without judgment.'
]

function optionByScore(options: EmojiOption[], score: number): EmojiOption {
  const index = Math.min(options.length - 1, Math.max(0, score - 1))
  return options[index]
}

function buildEmojiSnapshot(params: { mood: number; energy: number }) {
  return {
    mood: optionByScore(MOOD_OPTIONS, params.mood),
    energy: optionByScore(ENERGY_OPTIONS, params.energy),
  }
}

async function seedUser(supabase: ReturnType<typeof createClient>, userId: string, persona: TestPersona, days: number) {
  const today = toDateUTC(new Date())
  for (let i = days; i >= 1; i--) {
    const day = new Date(today.getTime() - i * 24 * 3600 * 1000)
    const dateOnly = asISODate(day)

    const entries = [
      {
        type: 'morning',
        mood: 3 + (i % 2),
        energy: 3 + ((i + 1) % 2),
        intention: pick(AM_NOTES, i),
        mindForToday: pick(AM_CONTEXTS, i),
        somatic: ['soft chest'],
      },
      {
        type: 'evening',
        mood: 2 + (i % 3),
        energy: 2 + ((i + 2) % 3),
        reflection: pick(PM_NOTES, i),
        wins: 'Completed a challenging task',
        gratitude: 'Learning about my system',
        somatic: ['loose shoulders'],
      }
    ] as const

    for (const e of entries) {
      const emojiSnapshot = buildEmojiSnapshot({
        mood: e.mood,
        energy: e.energy,
      })

      const dailyResponses =
        e.type === 'morning'
          ? {
              variant: 'morning' as const,
              emoji: emojiSnapshot,
              mindForToday: e.mindForToday,
              intention: e.intention,
              selectedPartIds: [],
              generatedEveningPrompt: {
                text: DEFAULT_PROMPT,
                created_at: new Date(dateOnly + 'T08:00:00Z').toISOString(),
              },
            }
          : {
              variant: 'evening' as const,
              emoji: emojiSnapshot,
              reflectionPrompt: { text: DEFAULT_PROMPT },
              reflection: e.reflection,
              wins: e.wins,
              gratitude: e.gratitude,
              selectedPartIds: [],
            }

      const partsData = {
        selected_part_ids: [] as string[],
        daily_responses: dailyResponses,
      }

      const row = {
        user_id: userId,
        type: e.type,
        check_in_date: dateOnly,
        mood: e.mood,
        energy_level: e.energy,
        intention: e.type === 'morning' ? e.intention : null,
        reflection: e.type === 'evening' ? e.reflection : null,
        wins: e.type === 'evening' && 'wins' in e ? e.wins : null,
        gratitude: e.type === 'evening' && 'gratitude' in e ? e.gratitude : null,
        parts_data: partsData,
        somatic_markers: e.somatic,
        created_at: new Date(dateOnly + (e.type === 'morning' ? 'T09:00:00Z' : 'T20:00:00Z')).toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('check_ins')
        .upsert(row, { onConflict: 'user_id,check_in_date,type' })

      if (error) throw new Error(`check_ins upsert failed (${dateOnly} ${e.type}): ${error.message}`)
    }
  }

  console.log(`✅ Seeded ${days * 2} check-ins for ${persona} (${userId})`)
}

async function main() {
  const { days } = parseArgs()
  const { url, serviceKey } = assertSafety()
  const supabase = createClient(url!, serviceKey!)

  const personas: TestPersona[] = ['beginner','moderate','advanced']
  for (const p of personas) {
    const userId = getPersonaUserId(p)
    await seedUser(supabase, userId, p, days)
  }

  console.log('🎉 Check-ins seeding complete')
}

main().catch((e) => {
  console.error('❌ Seeding failed:', e?.message || e)
  process.exit(1)
})
