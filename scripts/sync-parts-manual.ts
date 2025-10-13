#!/usr/bin/env tsx
/**
 * One-time manual sync script to backfill markdown part profiles into database
 * 
 * Usage:
 *   npx tsx scripts/sync-parts-manual.ts          # Local environment
 *   TARGET_ENV=prod npx tsx scripts/sync-parts-manual.ts  # Production environment
 * 
 * This script will:
 * 1. Discover all markdown part profiles in storage (local or Supabase)
 * 2. Parse their frontmatter and content
 * 3. Upsert them into the Supabase parts table
 */

import { config } from 'dotenv'
import { syncAllUserParts } from '@/lib/memory/parts-sync'

// Load environment variables from .env.local
config({ path: '.env.local' })

const USER_IDS = [
  '11111111-1111-1111-1111-111111111111',
  '8b8c3cd6-0e14-40a5-af10-d3e04b2c366f',
]

async function main() {
  const targetEnv = process.env.TARGET_ENV || 'local'
  const storageMode = process.env.MEMORY_STORAGE_ADAPTER || 'local'
  
  console.log('🌱 Starting manual parts sync...\n')
  console.log(`🌍 Environment: ${targetEnv.toUpperCase()}`)
  console.log(`📦 Storage: ${storageMode}`)
  console.log(`👥 Users: ${USER_IDS.join(', ')}\n`)
  
  let totalSynced = 0
  let totalFailed = 0
  
  for (const userId of USER_IDS) {
    console.log(`📦 Syncing parts for user: ${userId}`)
    try {
      const result = await syncAllUserParts(userId)
      console.log(`   ✅ Synced: ${result.synced}, Failed: ${result.failed}\n`)
      totalSynced += result.synced
      totalFailed += result.failed
    } catch (error) {
      console.error(`   ❌ Error syncing user ${userId}:`, error)
      console.log('')
    }
  }
  
  console.log('═══════════════════════════════════')
  console.log(`🎉 Sync complete!`)
  console.log(`   Total synced: ${totalSynced}`)
  console.log(`   Total failed: ${totalFailed}`)
  console.log('═══════════════════════════════════\n')
  
  if (totalSynced > 0) {
    console.log('💡 Next steps:')
    console.log('   1. Refresh your browser at /garden to see the parts')
    console.log('   2. Check the parts table in Supabase to verify data')
    console.log('')
  }
}

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
