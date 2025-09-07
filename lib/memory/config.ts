export const MEMORY_SNAPSHOTS_BUCKET = 'memory-snapshots'
export const MEMORY_LOCAL_ROOT = process.env.MEMORY_LOCAL_ROOT || '.data/memory-snapshots'

export function getStorageMode(): 'local' | 'supabase' {
  const env = (process.env.MEMORY_STORAGE_ADAPTER || '').toLowerCase()
  if (env === 'supabase') return 'supabase'
  return 'local'
}

// Feature flag helper for Memory v2 rollout
// Enabled when MEMORY_AGENTIC_V2_ENABLED is a truthy value like: '1', 'true', 'yes'
export function isMemoryV2Enabled(): boolean {
  const val = (process.env.MEMORY_AGENTIC_V2_ENABLED || '').toString().trim().toLowerCase()
  return val === '1' || val === 'true' || val === 'yes'
}

