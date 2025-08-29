#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { TEST_PERSONAS } from '../mastra/config/development'
import { fileURLToPath } from 'url'

// Load env from .env.local (preferred) or .env
const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

// Safety checks
function assertSafety() {
  if (process.env.IFS_DEV_MODE !== 'true') {
    throw new Error('IFS_DEV_MODE must be true to run persona seeding')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return { url, serviceKey }
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const wipe = args.includes('--wipe')
  const confirm = args.includes('--confirm') && args[args.indexOf('--confirm') + 1] === 'seed personas'
  
  if (!confirm) {
    throw new Error('Must include --confirm "seed personas" flag for safety')
  }

  return { wipe }
}

async function main() {
  console.log('🧪 IFS Persona Seeding Script')
  console.log('=============================')

  // Safety checks
  assertSafety()
  const { wipe } = parseArgs()
  const { url, serviceKey } = assertSafety()

  // Create admin client (bypasses RLS)
  const supabase = createClient(url, serviceKey)

  console.log('✅ Safety checks passed')
  console.log(`📊 Mode: ${wipe ? 'WIPE & SEED' : 'SEED ONLY'}`)

  // Verify tables exist
  console.log('🔍 Verifying database schema...')
  try {
    const { error: usersError } = await supabase.from('users').select('id').limit(1)
    if (usersError) throw new Error(`Users table check failed: ${usersError.message}`)
    
    const { error: partsError } = await supabase.from('parts').select('id').limit(1)  
    if (partsError) throw new Error(`Parts table check failed: ${partsError.message}`)

    console.log('✅ Database schema verified')
  } catch (error) {
    console.error('❌ Database schema verification failed:')
    console.error(error)
    process.exit(1)
  }

  // Optional wipe
  if (wipe) {
    console.log('🧹 Wiping existing persona data...')
    const personaIds = Object.values(TEST_PERSONAS).map(p => p.id)
    
    // Delete in dependency order
    const tables = ['agent_actions', 'insights', 'part_relationships', 'sessions', 'part_assessments', 'parts', 'users']
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('user_id', personaIds)
      
      if (error && !error.message.includes('violates foreign key')) {
        console.warn(`⚠️  Warning wiping ${table}: ${error.message}`)
      }
    }
    
    console.log('✅ Wipe completed')
  }

  // Create/upsert users
  console.log('👥 Creating persona users...')
  
  const users = Object.entries(TEST_PERSONAS).map(([key, config]) => ({
    id: config.id,
    email: config.email,
    name: config.name,
    settings: {
      timezone: 'UTC',
      privacyMode: false,
      aiDepth: 'medium' as const,
      notifications: {
        partEmergence: true,
        sessionReminders: true,
        weeklyInsights: true
      }
    },
    stats: {
      totalParts: 0,
      totalSessions: 0,
      streakDays: 0,
      longestSession: 0,
      averageSessionLength: 0
    }
  }))

  const { data: insertedUsers, error: usersError } = await supabase
    .from('users')
    .upsert(users, { onConflict: 'email' })
    .select()

  if (usersError) {
    console.error('❌ Failed to create users:', usersError)
    process.exit(1)
  }

  console.log('✅ Created/updated persona users:')
  Object.entries(TEST_PERSONAS).forEach(([key, config]) => {
    console.log(`   ${config.name} (${key}) - ${config.id}`)
  })

  // Verify users can be queried
  console.log('🔍 Verifying user access...')
  for (const [key, config] of Object.entries(TEST_PERSONAS)) {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', config.id)
      .single()

    if (error) {
      console.error(`❌ Failed to verify ${config.name}:`, error)
      process.exit(1)
    }

    console.log(`   ✅ ${config.name}: ${data.name} (${data.email})`)
  }

  console.log('')
  console.log('🎉 Persona seeding completed successfully!')
  console.log('')
  console.log('📝 Next steps:')
  console.log('   1. Set IFS_DEV_MODE=true in your .env.local')
  console.log('   2. Set IFS_TEST_PERSONA=beginner|moderate|advanced (optional)')
  console.log('   3. Start your dev server: npm run dev')
  console.log('   4. Use the persona switcher in the UI to test different users')
  console.log('')
  console.log('💡 Tip: Add richer IFS data later with additional seeding scripts')
}

// Run if called directly (ESM-compatible)
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((error) => {
    console.error('❌ Seeding failed:', error.message)
    process.exit(1)
  })
}
