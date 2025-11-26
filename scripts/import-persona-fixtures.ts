#!/usr/bin/env tsx

// Import persona fixtures from seeds/personas/data and upsert into Supabase.
// IMPORTANT: Generation is done offline (fixtures). This script only migrates.

import dotenv from 'dotenv'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

function assertSafety() {
  if (process.env.IFS_DEV_MODE !== 'true') {
    throw new Error('IFS_DEV_MODE must be true to run fixture import')
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return { url, serviceKey }
}

interface Fixture {
  user: any
  parts?: any[]
  part_relationships?: any[]
  part_assessments?: any[]
  sessions?: any[]
  insights?: any[]
}

async function importFixture(supabase: any, fixture: Fixture) {
  const user = fixture.user
  const userId = user.id

  // Upsert user
  {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        settings: user.settings,
        stats: user.stats,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
    if (error) throw new Error(`User upsert failed: ${error.message}`)
  }

  // Insert parts
  if (fixture.parts?.length) {
    for (const p of fixture.parts) {
      const { error } = await supabase.from('parts').upsert(p, { onConflict: 'id' })
      if (error) throw new Error(`Part upsert failed (${p.name}): ${error.message}`)
    }
  }

  // Insert sessions
  if (fixture.sessions?.length) {
    for (const s of fixture.sessions) {
      const { error } = await supabase.from('sessions').upsert(s, { onConflict: 'id' })
      if (error) throw new Error(`Session upsert failed (${s.id}): ${error.message}`)
    }
  }

  // Insert relationships
  if (fixture.part_relationships?.length) {
    for (const r of fixture.part_relationships) {
      const { error } = await supabase.from('part_relationships').upsert(r, { onConflict: 'id' })
      if (error) throw new Error(`Relationship upsert failed (${r.id}): ${error.message}`)
    }
  }

  // Insert assessments
  if (fixture.part_assessments?.length) {
    for (const a of fixture.part_assessments) {
      const { error } = await supabase.from('part_assessments').upsert(a)
      if (error) throw new Error(`Assessment insert failed: ${error.message}`)
    }
  }

  // Insert insights
  if (fixture.insights?.length) {
    for (const i of fixture.insights) {
      const payload = {
        ...i,
        // Map legacy 'meta' field to 'metadata' for inbox_items table
        metadata: i.meta || i.metadata || {},
        meta: undefined,
        processed: typeof i.processed === 'boolean' ? i.processed : false,
        processed_at: 'processed_at' in i ? (i.processed_at ?? null) : null,
        evidence: i.evidence || [],
        related_part_ids: i.related_part_ids || [],
        source_session_ids: i.source_session_ids || [],
        source_type: i.source_type || 'insight_generated',
      }
      // Remove undefined 'meta' key
      delete (payload as Record<string, unknown>).meta
      const { error } = await supabase.from('inbox_items').insert(payload)
      if (error) throw new Error(`Insight insert failed: ${error.message}`)
    }
  }

  return userId
}

async function main() {
  const { url, serviceKey } = assertSafety()
  const dir = process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : 'seeds/personas/data'
  const confirmed = process.argv.includes('--confirm') && (process.argv[process.argv.indexOf('--confirm') + 1] || '').toLowerCase() === 'import fixtures'
  const wipe = process.argv.includes('--wipe')

  if (!confirmed) throw new Error('Must include --confirm "import fixtures" for safety')

  const supabase = createClient(url, serviceKey)

  const files = readdirSync(dir).filter(f => f.endsWith('.json'))
  if (!files.length) {
    console.log(`No fixture files found in ${dir}`)
    return
  }

  console.log('📦 Importing persona fixtures from', dir)
  const personaIds: string[] = []

  if (wipe) {
    console.log('🧹 Wiping existing data for test personas (insights, relationships, sessions, assessments, parts)...')
    // Collect all user IDs from fixtures
    const idsInDir = files.map(f => {
      const payload = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Fixture
      return payload.user.id
    })
    const { error: wipeErr } = await supabase.rpc('noop') // placeholder to ensure client ready
    if (wipeErr) { /* ignore */ }

    // Delete in dependency order
    const tables = ['agent_actions','insights','part_relationships','sessions','part_assessments','parts']
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().in('user_id', idsInDir)
      if (error) console.warn(`⚠️  Wipe warning on ${table}: ${error.message}`)
    }
  }

  for (const f of files) {
    const payload = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Fixture
    const userId = await importFixture(supabase, payload)
    personaIds.push(userId)
    console.log(`✅ Imported: ${payload.user.name} (${f})`)
  }

  console.log('🎉 Import completed for users:', personaIds.join(', '))
}

const isDirect = process.argv[1]?.endsWith('import-persona-fixtures.ts') || process.argv[1]?.endsWith('import-persona-fixtures.js')
if (isDirect) {
  main().catch((e) => {
    console.error('❌ Import failed:', e?.message || e)
    process.exit(1)
  })
}

