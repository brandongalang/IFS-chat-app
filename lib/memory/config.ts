export const MEMORY_SNAPSHOTS_BUCKET = 'memory-snapshots'
export const MEMORY_LOCAL_ROOT = process.env.MEMORY_LOCAL_ROOT || '.data/memory-snapshots'

export function getStorageMode(): 'local' | 'supabase' {
  const env = (process.env.MEMORY_STORAGE_ADAPTER || '').toLowerCase()
  if (env === 'supabase') return 'supabase'
  return 'local'
}

