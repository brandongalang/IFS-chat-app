/**
 * Debug script to check parts sync status
 */
import { discoverUserParts, syncAllUserParts } from '@/lib/memory/parts-sync'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

const userId = process.env.IFS_DEFAULT_USER_ID || '11111111-1111-1111-1111-111111111111'

async function debug() {
  console.log('=== Parts Sync Debug ===')
  console.log(`User ID: ${userId}`)
  
  try {
    // Check storage adapter
    console.log('\n1. Getting storage adapter...')
    const storage = await getStorageAdapter()
    console.log(`Storage adapter: ${storage.constructor.name}`)
    
    // Try to list files
    console.log('\n2. Listing files in storage...')
    const basePath = `users/${userId}/parts`
    try {
      const files = await storage.list(basePath)
      console.log(`Found ${files.length} files`)
      if (files.length > 0) {
        console.log('Files:', files.slice(0, 5))
      }
    } catch (error) {
      console.error('Error listing files:', error)
    }
    
    // Try discoverUserParts
    console.log('\n3. Discovering parts...')
    const partIds = await discoverUserParts(userId)
    console.log(`Discovered ${partIds.length} parts:`, partIds)
    
    // Try sync
    console.log('\n4. Attempting sync...')
    const result = await syncAllUserParts(userId)
    console.log(`Sync result: ${result.synced} synced, ${result.failed} failed`)
    
  } catch (error) {
    console.error('Error:', error)
    if (error instanceof Error) {
      console.error('Stack:', error.stack)
    }
  }
}

debug()
