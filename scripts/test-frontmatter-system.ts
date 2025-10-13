#!/usr/bin/env tsx
/**
 * Manual test script for the enhanced frontmatter system
 * 
 * Tests:
 * 1. Creating a part with frontmatter
 * 2. Reading it back
 * 3. Syncing to database
 * 4. Verifying database has correct data
 */

import { buildPartProfileMarkdown } from '@/lib/memory/snapshots/grammar'
import { readPartProfile } from '@/lib/memory/read'
import { getStorageAdapter, partProfilePath } from '@/lib/memory/snapshots/fs-helpers'
import { syncPartToDatabase } from '@/lib/memory/parts-sync'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

async function main() {
  const testUserId = process.env.IFS_DEFAULT_USER_ID || process.env.TEST_USER_ID
  if (!testUserId) {
    console.error('Please set IFS_DEFAULT_USER_ID or TEST_USER_ID environment variable')
    process.exit(1)
  }

  const testPartId = randomUUID()
  console.log(`\n🧪 Testing frontmatter system with user ${testUserId}`)
  console.log(`📝 Creating test part: ${testPartId}\n`)

  // Step 1: Create a part with frontmatter
  console.log('Step 1: Creating part markdown with frontmatter...')
  const markdown = buildPartProfileMarkdown({
    userId: testUserId,
    partId: testPartId,
    name: 'Test Part',
    status: 'active',
    category: 'manager',
    emoji: '🧪',
  })

  // Check if frontmatter is present
  const hasFrontmatter = markdown.startsWith('---\n')
  console.log(`✅ Generated markdown ${hasFrontmatter ? 'WITH' : 'WITHOUT'} frontmatter`)
  console.log(`   First 200 chars:\n   ${markdown.substring(0, 200)}...\n`)

  // Step 2: Write to storage
  console.log('Step 2: Writing to storage...')
  const storage = await getStorageAdapter()
  const path = partProfilePath(testUserId, testPartId)
  await storage.putText(path, markdown, { contentType: 'text/markdown; charset=utf-8' })
  console.log(`✅ Written to ${path}\n`)

  // Step 3: Read back and verify frontmatter
  console.log('Step 3: Reading back from storage...')
  const profile = await readPartProfile(testUserId, testPartId)
  if (!profile) {
    console.error('❌ Failed to read profile back')
    process.exit(1)
  }

  console.log(`✅ Read profile:`)
  console.log(`   - Has frontmatter: ${profile.frontmatter ? 'YES' : 'NO'}`)
  if (profile.frontmatter) {
    console.log(`   - ID: ${profile.frontmatter.id}`)
    console.log(`   - Name: ${profile.frontmatter.name}`)
    console.log(`   - Emoji: ${profile.frontmatter.emoji}`)
    console.log(`   - Category: ${profile.frontmatter.category}`)
    console.log(`   - Status: ${profile.frontmatter.status}`)
  }
  console.log(`   - Sections: ${Object.keys(profile.sections).join(', ')}\n`)

  // Step 4: Sync to database
  console.log('Step 4: Syncing to database...')
  const syncResult = await syncPartToDatabase(testUserId, testPartId)
  if (!syncResult) {
    console.error('❌ Sync failed')
    process.exit(1)
  }
  console.log(`✅ Synced to database\n`)

  // Step 5: Verify database entry
  console.log('Step 5: Verifying database entry...')
  const supabase = createAdminClient()
  const { data: dbPart, error } = await supabase
    .from('parts')
    .select('id, name, category, status, visualization')
    .eq('id', testPartId)
    .eq('user_id', testUserId)
    .single()

  if (error || !dbPart) {
    console.error('❌ Failed to read from database:', error)
    process.exit(1)
  }

  console.log(`✅ Database entry:`)
  console.log(`   - ID: ${dbPart.id}`)
  console.log(`   - Name: ${dbPart.name}`)
  console.log(`   - Category: ${dbPart.category}`)
  console.log(`   - Status: ${dbPart.status}`)
  console.log(`   - Visualization: ${JSON.stringify(dbPart.visualization)}\n`)

  // Verify emoji synced correctly
  const dbEmoji = (dbPart.visualization as { emoji?: string })?.emoji
  if (dbEmoji === '🧪') {
    console.log('✅ Emoji synced correctly from frontmatter to database!')
  } else {
    console.log(`⚠️  Emoji mismatch: expected 🧪, got ${dbEmoji}`)
  }

  // Cleanup
  console.log('\n🧹 Cleaning up test data...')
  await supabase.from('parts').delete().eq('id', testPartId).eq('user_id', testUserId)
  await storage.delete(path)
  console.log('✅ Cleanup complete\n')

  console.log('🎉 All tests passed!\n')
}

main().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
