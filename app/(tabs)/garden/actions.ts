'use server'

import { syncAllUserParts } from '@/lib/memory/parts-sync'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Manually sync all markdown part profiles to database for the current user
 * Useful for backfilling or recovery after sync failures
 */
export async function syncPartsAction() {
  console.log('[syncPartsAction] ========================================');
  console.log('[syncPartsAction] Sync button clicked!');
  console.log('[syncPartsAction] ========================================');
  try {
    console.log('[syncPartsAction] Creating Supabase client');
    const supabase = await createClient();
    console.log('[syncPartsAction] Getting authenticated user');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[syncPartsAction] Auth error:', authError);
    }

    if (!user) {
      console.error('[syncPartsAction] No authenticated user found');
      return {
        success: false,
        error: 'Not authenticated',
        synced: 0,
        failed: 0,
      };
    }

    console.log(`[syncPartsAction] User authenticated: ${user.id}`);
    console.log(`[syncPartsAction] User email: ${user.email}`);
    console.log(`[syncPartsAction] Starting manual sync for user ${user.id}`);

    const result = await syncAllUserParts(user.id);

    console.log('[syncPartsAction] Revalidating /garden path');
    // Revalidate the garden page to show newly synced parts
    revalidatePath('/garden');

    console.log(`[syncPartsAction] ========================================`);
    console.log(`[syncPartsAction] Complete: ${result.synced} synced, ${result.failed} failed`);
    console.log(`[syncPartsAction] ========================================`);

    return {
      success: true,
      synced: result.synced,
      failed: result.failed,
    };
  } catch (error) {
    console.error('[syncPartsAction] ========================================');
    console.error('[syncPartsAction] Unexpected error:', error);
    console.error('[syncPartsAction] Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[syncPartsAction] ========================================');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      synced: 0,
      failed: 0,
    };
  }
}
