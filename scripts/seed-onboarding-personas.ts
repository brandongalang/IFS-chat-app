#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { TEST_PERSONAS, type TestPersona, getPersonaUserId } from '../config/personas'

const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

type Args = { confirm: boolean }

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const i = args.indexOf('--confirm')
  const ok = i >= 0 && (args[i + 1] || '').toLowerCase() === 'seed onboarding'
  if (!ok) throw new Error('Must include --confirm "seed onboarding"')
  return { confirm: true }
}

function assertSafety() {
  if (process.env.IFS_DEV_MODE !== 'true') {
    throw new Error('IFS_DEV_MODE must be true to run onboarding seeding')
  }
  const isStaging = process.env.TARGET_ENV === 'staging'
  const url = isStaging ? process.env.STAGING_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = isStaging ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase URL or Service Role Key')
  return { url, serviceKey }
}

// Simple persona-specific theme score presets for Stage 1
const STAGE1_SCORES: Record<TestPersona, Record<string, number>> = {
  beginner: { self_criticism: 0.6, anxiety: 0.55, perfectionism: 0.5, avoidance: 0.45 },
  moderate: { achievement: 0.7, relational: 0.5, conflict_avoidance: 0.45, safety: 0.5 },
  advanced: { independence: 0.6, self_criticism: 0.5, caretaking: 0.6, control: 0.5 }
}

async function seedUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  persona: TestPersona
) {
  // Fetch onboarding questions
  const { data: questions, error: qErr } = await supabase
    .from('onboarding_questions')
    .select('id, stage, type, options, order_hint')
    .eq('active', true)
    .order('stage', { ascending: true })
    .order('order_hint', { ascending: true })

  if (qErr) throw new Error(`Failed to fetch onboarding_questions: ${qErr.message}`)

  // Prepare a minimal but diverse answer-set
  const answersSnapshot: Record<string, any> = {}
  const responses: any[] = []
  const stage2Selected: string[] = []

  for (const q of questions || []) {
    const qid = q.id as string
    const stage = q.stage as number
    const type = q.type as string

    let response: any
    if (type === 'single_choice') {
      // Pick the first or second option depending on persona and q order
      const opts = Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options as any) } catch { return [] } })()
      const pickIndex = (persona === 'advanced' ? 1 : 0)
      const choice = opts[pickIndex] || opts[0] || { value: 'unknown', label: 'Unknown' }
      response = { type: 'single_choice', value: choice.value }
      if (stage === 2) stage2Selected.push(qid)
    } else if (type === 'multi_select') {
      const opts = Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options as any) } catch { return [] } })()
      const vals = opts.slice(0, 2).map((o: any) => o.value)
      response = { type: 'multi_select', values: vals }
    } else if (type === 'free_text') {
      response = { type: 'free_text', text: `Seeded answer for ${qid} (${persona})` }
    } else if (type === 'likert5') {
      response = { type: 'likert5', value: 3 }
    } else {
      response = { type: 'unknown', value: null }
    }

    answersSnapshot[qid] = response

    responses.push({
      user_id: userId,
      question_id: qid,
      stage,
      response,
      created_at: new Date().toISOString()
    })
  }

  // Upsert responses (unique on user_id, question_id)
  for (const r of responses) {
    const { error } = await supabase.from('onboarding_responses').upsert(r, { onConflict: 'user_id,question_id' })
    if (error) throw new Error(`onboarding_responses upsert failed (${r.question_id}): ${error.message}`)
  }

  const now = new Date().toISOString()
  const startedAt = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()

  const up = {
    user_id: userId,
    feature_version: 'v1',
    stage: 'complete' as any,
    status: 'completed',
    started_at: startedAt,
    completed_at: now,
    last_saved_at: now,
    updated_at: now,
    stage1_scores: STAGE1_SCORES[persona] || {},
    stage2_selected_questions: stage2Selected.slice(0, 4),
    answers_snapshot: answersSnapshot
  }

  const { error: upErr } = await supabase
    .from('user_onboarding')
    .upsert(up, { onConflict: 'user_id' })

  if (upErr) throw new Error(`user_onboarding upsert failed: ${upErr.message}`)

  console.log(`✅ Seeded onboarding for ${persona} (${userId})`)
}

async function main() {
  parseArgs()
  const { url, serviceKey } = assertSafety()
  const supabase = createClient(url!, serviceKey!)

  const personas: TestPersona[] = ['beginner','moderate','advanced']
  for (const p of personas) {
    const userId = getPersonaUserId(p)
    await seedUser(supabase, userId, p)
  }

  console.log('🎉 Onboarding seeding complete')
}

main().catch((e) => {
  console.error('❌ Seeding failed:', e?.message || e)
  process.exit(1)
})

