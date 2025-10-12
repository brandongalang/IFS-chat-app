'use server'

import { syncAllUserParts } from '@/lib/memory/parts-sync'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Manually sync all markdown part profiles to database for the current user
 * Useful for backfilling or recovery after sync failures
 */
export async function syncPartsAction() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
        synced: 0,
        failed: 0,
      }
    }

    console.log(`[syncPartsAction] Starting manual sync for user ${user.id}`)
    const result = await syncAllUserParts(user.id)
    
    // Revalidate the garden page to show newly synced parts
    revalidatePath('/garden')
    
    console.log(`[syncPartsAction] Complete: ${result.synced} synced, ${result.failed} failed`)
    
    return {
      success: true,
      synced: result.synced,
      failed: result.failed,
    }
  } catch (error) {
    console.error('[syncPartsAction] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      synced: 0,
      failed: 0,
    }
  }
}
