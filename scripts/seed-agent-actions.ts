#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { getPersonaUserId, type TestPersona } from '../config/personas'

const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

type Args = { confirm: boolean }

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const ok = args.includes('--confirm') && ((args[args.indexOf('--confirm') + 1] || '').toLowerCase() === 'seed agent actions')
  if (!ok) throw new Error('Must include --confirm "seed agent actions"')
  return { confirm: true }
}

function assertSafety() {
  if (process.env.IFS_DEV_MODE !== 'true') throw new Error('IFS_DEV_MODE must be true to run agent actions seeding')
  const isStaging = process.env.TARGET_ENV === 'staging'
  const url = isStaging ? process.env.STAGING_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = isStaging ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase URL or Service Role Key')
  return { url, serviceKey }
}

async function seedForPersona(supabase: ReturnType<typeof createClient>, persona: TestPersona) {
  const userId = getPersonaUserId(persona)
  // Pick 2 parts by highest confidence
  const { data: parts, error: pErr } = await supabase
    .from('parts')
    .select('id, name, confidence, visualization')
    .eq('user_id', userId)
    .order('confidence', { ascending: false })
    .limit(2)

  if (pErr) throw new Error(`Fetch parts failed (${persona}): ${pErr.message}`)
  if (!parts?.length) { console.log(`(no parts for ${persona})`); return }

  for (const part of parts) {
    // A unique operation key for idempotency
    const opKey1 = `conf-bump-${part.id}-v1`
    const opKey2 = `viz-tint-${part.id}-v1`

    // Check existence by metadata.operationKey
    const { data: ex1 } = await supabase
      .from('agent_actions')
      .select('id')
      .eq('user_id', userId)
      .eq('action_type', 'update_part_confidence')
      .eq('target_table', 'parts')
      .eq('target_id', part.id)
      .contains('metadata', { operationKey: opKey1 })
      .maybeSingle()

    if (!ex1) {
      const oldConf = part.confidence ?? 0.5
      const newConf = Math.min(1, oldConf + 0.05)
      const row1 = {
        user_id: userId,
        action_type: 'update_part_confidence',
        target_table: 'parts',
        target_id: part.id,
        old_state: { confidence: oldConf },
        new_state: { confidence: newConf },
        metadata: { operationKey: opKey1, partName: part.name, description: `increased confidence from ${oldConf} to ${newConf}` },
        created_by: 'agent'
      }
      const { error: ins1 } = await supabase.from('agent_actions').insert(row1)
      if (ins1) throw new Error(`Insert agent_action conf failed: ${ins1.message}`)
    }

    const { data: ex2 } = await supabase
      .from('agent_actions')
      .select('id')
      .eq('user_id', userId)
      .eq('action_type', 'update_part_visualization')
      .eq('target_table', 'parts')
      .eq('target_id', part.id)
      .contains('metadata', { operationKey: opKey2 })
      .maybeSingle()

    if (!ex2) {
      const oldViz = part.visualization || { color: '#6B7280', emoji: '🤗', energyLevel: 0.5 }
      const newViz = { ...oldViz, color: '#5B93F0' }
      const row2 = {
        user_id: userId,
        action_type: 'update_part_visualization',
        target_table: 'parts',
        target_id: part.id,
        old_state: oldViz,
        new_state: newViz,
        metadata: { operationKey: opKey2, partName: part.name, description: 'changed color tint' },
        created_by: 'agent'
      }
      const { error: ins2 } = await supabase.from('agent_actions').insert(row2)
      if (ins2) throw new Error(`Insert agent_action viz failed: ${ins2.message}`)
    }
  }

  console.log(`✅ Seeded agent_actions for ${persona}`)
}

async function main() {
  parseArgs()
  const { url, serviceKey } = assertSafety()
  const supabase = createClient(url!, serviceKey!)
  const personas: TestPersona[] = ['beginner','moderate','advanced']
  for (const p of personas) {
    await seedForPersona(supabase, p)
  }
  console.log('🎉 Agent actions seeding complete')
}

main().catch((e) => { console.error('❌ Seeding failed:', e?.message || e); process.exit(1) })

