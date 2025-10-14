#!/usr/bin/env node
/**
 * Test script to manually trigger parts sync and see detailed logs
 * Usage: npx tsx scripts/test-parts-sync.ts <email>
 */

import { syncAllUserParts, discoverUserParts } from '@/lib/memory/parts-sync'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { createAdminClient } from '@/lib/supabase/admin'

const email = process.argv[2]
if (!email) {
  console.error('❌ Please provide an email address')
  console.error('Usage: npx tsx scripts/test-parts-sync.ts <email>')
  process.exit(1)
}

async function main() {
  console.log(`\n🔍 Testing parts sync for: ${email}\n`)

  // 1. Get user profile
  const supabase = createAdminClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    console.error('❌ Profile not found:', profileError?.message)
    return
  }

  console.log(`✅ Found user: ${profile.id}`)

  // 2. Check storage directly
  console.log('\n--- Checking Supabase Storage ---')
  const storage = await getStorageAdapter()
  
  // Try different path patterns
  const pathsToTry = [
    `${profile.id}/parts`,
    `users/${profile.id}/parts`,
    profile.id,
  ]

  for (const path of pathsToTry) {
    console.log(`\nTrying path: ${path}`)
    try {
      const entries = await storage.list(path)
      console.log(`  Found ${entries.length} entries:`)
      entries.slice(0, 10).forEach(entry => {
        console.log(`    - ${entry}`)
      })
      if (entries.length > 10) {
        console.log(`    ... and ${entries.length - 10} more`)
      }
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 3. Try discovering parts
  console.log('\n--- Discovering Parts ---')
  const partIds = await discoverUserParts(profile.id)
  console.log(`Discovered ${partIds.length} parts:`, partIds)

  // 4. Run full sync
  console.log('\n--- Running Sync ---')
  const result = await syncAllUserParts(profile.id)
  console.log(`\n✅ Sync complete:`)
  console.log(`   Synced: ${result.synced}`)
  console.log(`   Failed: ${result.failed}`)

  // 5. Check database
  console.log('\n--- Checking Database ---')
  const { data: dbParts, count } = await supabase
    .from('parts')
    .select('id, name, category, status', { count: 'exact' })
    .eq('user_id', profile.id)

  console.log(`Found ${count} parts in database:`)
  dbParts?.forEach((part, i) => {
    console.log(`  ${i + 1}. ${part.name} (${part.category}) - ${part.status}`)
  })
}

main().catch(console.error)
