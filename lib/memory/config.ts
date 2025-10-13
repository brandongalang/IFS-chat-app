import { env } from '@/config/env'

export const MEMORY_SNAPSHOTS_BUCKET = 'memory-snapshots'

/**
 * Storage mode for Memory V2 system.
 * Always uses Supabase Storage for production reliability.
 */
export function getStorageMode(): 'supabase' {
  return 'supabase'
}

/**
 * Feature flag for Memory v2 rollout.
 * Defaults to enabled unless explicitly disabled with '0', 'false', or 'no'.
 */
export function isMemoryV2Enabled(): boolean {
  return env.memoryV2Enabled
}

