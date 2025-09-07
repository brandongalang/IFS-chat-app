#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { getPersonaUserId, type TestPersona } from '../config/personas'

const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

type Args = { confirm: boolean; perSession?: number }

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const get = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : undefined }
  const ok = args.includes('--confirm') && (get('--confirm') || '').toLowerCase() === 'seed feedback'
  if (!ok) throw new Error('Must include --confirm "seed feedback"')
  const perSession = parseInt(get('--per-session') || '1', 10)
  return { confirm: true, perSession }
}

function assertSafety() {
  if (process.env.IFS_DEV_MODE !== 'true') throw new Error('IFS_DEV_MODE must be true to run feedback seeding')
  const isStaging = process.env.TARGET_ENV === 'staging'
  const url = isStaging ? process.env.STAGING_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = isStaging ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase URL or Service Role Key')
  return { url, serviceKey }
}

function pick<T>(arr: T[], idx: number) { return arr[idx % arr.length] }

const EXPLAIN = [
  'This resonated and felt accurate to my experience.',
  'A bit off; I would describe it differently.',
  'Helpful reflection—thank you.'
]

async function seedForPersona(supabase: ReturnType<typeof createClient>, persona: TestPersona, perSession: number) {
  const userId = getPersonaUserId(persona)
  // Recent sessions first
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('id, user_id, messages, end_time')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(6)

  if (sErr) throw new Error(`Fetch sessions failed (${persona}): ${sErr.message}`)
  if (!sessions?.length) { console.log(`(no sessions for ${persona})`); return }

  for (const [sIdx, s] of sessions.entries()) {
    // Collect assistant messages with their positional index
    const msgs: Array<{ idx: number; ts?: string }> = (s.messages || []).map((m: any, i: number) => ({ idx: i, ts: m.timestamp, role: m.role })).filter(m => (m as any).role === 'assistant') as any
    const toRate = msgs.slice(0, perSession)

    for (const [i, m] of toRate.entries()) {
      const messageId = `${s.id}:assistant:${m.idx}`
      // Pre-check
      const { data: exists, error: exErr } = await supabase
        .from('message_feedback')
        .select('id')
        .eq('user_id', userId)
        .eq('message_id', messageId)
        .maybeSingle()

      if (!exErr && exists) { continue }

      const rating = (sIdx + i) % 3 === 0 ? 'thumb_down' : 'thumb_up'
      const explanation = pick(EXPLAIN, sIdx + i)

      const row = {
        session_id: s.id,
        message_id: messageId,
        user_id: userId,
        rating,
        explanation,
        created_at: m.ts || s.end_time || new Date().toISOString()
      }

      const { error: insErr } = await supabase.from('message_feedback').insert(row)
      if (insErr) throw new Error(`Insert feedback failed: ${insErr.message}`)
    }
  }

  console.log(`✅ Seeded feedback for ${persona}`)
}

async function main() {
  const { perSession } = parseArgs()
  const { url, serviceKey } = assertSafety()
  const supabase = createClient(url!, serviceKey!)
  const personas: TestPersona[] = ['beginner','moderate','advanced']
  for (const p of personas) {
    await seedForPersona(supabase, p, perSession)
  }
  console.log('🎉 Feedback seeding complete')
}

main().catch((e) => { console.error('❌ Seeding failed:', e?.message || e); process.exit(1) })

