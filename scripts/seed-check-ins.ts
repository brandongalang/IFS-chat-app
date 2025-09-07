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

const AM_NOTES = [
  'Set an intention to stay curious with parts.',
  'Notice sensations before diving into tasks.',
  'Invite a gentle pace and self-trust.'
]
const PM_NOTES = [
  'Reflected on protector showing up after feedback.',
  'Grateful for small moments of ease.',
  'Saw a pattern and noted it without judgment.'
]

async function seedUser(supabase: ReturnType<typeof createClient>, userId: string, persona: TestPersona, days: number) {
  const today = toDateUTC(new Date())
  for (let i = days; i >= 1; i--) {
    const day = new Date(today.getTime() - i * 24 * 3600 * 1000)
    const dateOnly = asISODate(day)

    const entries = [
      { type: 'morning', mood: 3 + (i % 2), energy: 3 + ((i+1) % 2), intention: pick(AM_NOTES, i), reflection: null, gratitude: 'A warm conversation', somatic: ['soft chest'] },
      { type: 'evening', mood: 2 + (i % 3), energy: 2 + ((i+2) % 3), intention: null, reflection: pick(PM_NOTES, i), gratitude: 'Learning about my system', somatic: ['loose shoulders'] }
    ] as const

    for (const e of entries) {
      const row = {
        user_id: userId,
        type: e.type,
        check_in_date: dateOnly,
        mood: e.mood,
        energy_level: e.energy,
        intention: e.intention,
        reflection: e.reflection,
        gratitude: e.gratitude,
        parts_data: {},
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

