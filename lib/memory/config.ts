export const MEMORY_SNAPSHOTS_BUCKET = 'memory-snapshots'
export const MEMORY_LOCAL_ROOT = process.env.MEMORY_LOCAL_ROOT || '.data/memory-snapshots'

export function getStorageMode(): 'local' | 'supabase' {
  const env = (process.env.MEMORY_STORAGE_ADAPTER || '').toLowerCase()
  if (env === 'supabase') return 'supabase'
  return 'local'
}

// Feature flag helper for Memory v2 rollout
// Defaults to enabled unless explicitly disabled with '0', 'false', or 'no'.
export function isMemoryV2Enabled(): boolean {
  const raw = process.env.MEMORY_AGENTIC_V2_ENABLED
  const val = (raw ?? '').toString().trim().toLowerCase()
  if (!val) return true
  if (val === '0' || val === 'false' || val === 'no') return false
  // Any other value (including '1','true','yes') enables
  return true
}

