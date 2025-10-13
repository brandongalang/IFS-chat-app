#!/usr/bin/env tsx
/**
 * Diagnostic script to understand why Garden shows 0 parts
 */

import { config } from 'dotenv'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { discoverUserParts } from '@/lib/memory/parts-sync'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function main() {
  const testUserId = process.env.IFS_DEFAULT_USER_ID || process.env.TEST_USER_ID
  const targetEnv = process.env.TARGET_ENV || 'local'
  
  console.log('\n🔍 Garden Diagnostic\n')
  console.log('='.repeat(60))
  console.log(`\n🌍 Environment: ${targetEnv.toUpperCase()}`)
  if (targetEnv === 'prod') {
    console.log('   Using PROD_* environment variables')
  } else {
    console.log('   Using NEXT_PUBLIC_* environment variables')
  }
  
  // Check 1: Database parts
  console.log('\n📊 Checking database parts...')
  const supabase = createAdminClient()
  
  let userParts: Array<{ id: string; name: string; category: string; status: string; created_at: string }> | null = null
  
  if (testUserId) {
    const { data, error: userError } = await supabase
      .from('parts')
      .select('id, name, category, status, created_at')
      .eq('user_id', testUserId)
    
    userParts = data
    
    if (userError) {
      console.error(`   ❌ Error querying user parts: ${userError.message}`)
    } else {
      console.log(`   ✅ Found ${userParts?.length || 0} parts for user ${testUserId}`)
      if (userParts && userParts.length > 0) {
        userParts.forEach(part => {
          console.log(`      - ${part.name} (${part.category}, ${part.status})`)
        })
      }
    }
  } else {
    console.log('   ⚠️  No test user ID set (IFS_DEFAULT_USER_ID or TEST_USER_ID)')
  }
  
  const { data: allParts, error: allError } = await supabase
    .from('parts')
    .select('id, user_id, name')
    .limit(10)
  
  if (allError) {
    console.error(`   ❌ Error querying all parts: ${allError.message}`)
  } else {
    console.log(`   ℹ️  Total parts in database: ${allParts?.length || 0}`)
  }
  
  // Check 2: Markdown files
  console.log('\n📝 Checking markdown storage...')
  const storage = await getStorageAdapter()
  const storageMode = process.env.MEMORY_STORAGE_ADAPTER || 'local'
  console.log(`   Storage mode: ${storageMode}`)
  
  if (testUserId) {
    try {
      const partIds = await discoverUserParts(testUserId)
      console.log(`   ✅ Found ${partIds.length} markdown part profiles for user ${testUserId}`)
      if (partIds.length > 0) {
        partIds.forEach(id => {
          console.log(`      - ${id}`)
        })
      }
    } catch (error) {
      console.error(`   ❌ Error discovering parts: ${error instanceof Error ? error.message : error}`)
    }
  }
  
  // Check 3: Configuration
  console.log('\n⚙️  Configuration:')
  console.log(`   TARGET_ENV: ${process.env.TARGET_ENV || 'local (default)'}`)
  console.log(`   IFS_DEFAULT_USER_ID: ${process.env.IFS_DEFAULT_USER_ID || '(not set)'}`)
  console.log(`   TEST_USER_ID: ${process.env.TEST_USER_ID || '(not set)'}`)
  console.log(`   MEMORY_STORAGE_ADAPTER: ${process.env.MEMORY_STORAGE_ADAPTER || 'local (default)'}`)
  console.log(`   MEMORY_LOCAL_ROOT: ${process.env.MEMORY_LOCAL_ROOT || '.data/memory-snapshots (default)'}`)
  
  // Check 4: Recommendations
  console.log('\n💡 Recommendations:\n')
  
  if (!testUserId) {
    console.log('   1. Set IFS_DEFAULT_USER_ID in .env.local to your user ID')
  }
  
  if (testUserId && (!allParts || allParts.length === 0)) {
    console.log('   1. No parts found - create parts via chat first')
    console.log('   2. Or run: tsx scripts/test-frontmatter-system.ts (requires IFS_DEFAULT_USER_ID)')
  }
  
  if (testUserId && allParts && allParts.length > 0) {
    const userHasParts = userParts && userParts.length > 0
    const userHasMarkdown = (await discoverUserParts(testUserId).catch(() => [])).length > 0
    
    if (!userHasParts && !userHasMarkdown) {
      console.log('   1. Database has parts but none for your user')
      console.log('   2. Create parts via chat or switch to a different user ID')
    } else if (userHasMarkdown && !userHasParts) {
      console.log('   1. Markdown files exist but not synced to database')
      console.log('   2. Click "Refresh" in Garden to trigger sync')
      console.log('   3. Or run: tsx scripts/sync-parts-manual.ts')
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n')
}

main().catch((error) => {
  console.error('❌ Diagnostic failed:', error)
  process.exit(1)
})
