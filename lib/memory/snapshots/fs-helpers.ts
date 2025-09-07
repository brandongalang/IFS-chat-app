import { MEMORY_SNAPSHOTS_BUCKET, MEMORY_LOCAL_ROOT, getStorageMode } from '../config'
import type { StorageAdapter } from '../storage/adapter'
import { LocalFsStorageAdapter } from '../storage/local-fs-adapter'
import { SupabaseStorageAdapter } from '../storage/supabase-storage-adapter'

export function getStorageAdapter(): StorageAdapter {
  const mode = getStorageMode()
  if (mode === 'supabase') return new SupabaseStorageAdapter()
  return new LocalFsStorageAdapter()
}

export function partProfilePath(userId: string, partId: string) {
  return `users/${userId}/parts/${partId}/profile.md`
}

export function userOverviewPath(userId: string) {
  return `users/${userId}/overview.md`
}

export function relationshipProfilePath(userId: string, relId: string) {
  return `users/${userId}/relationships/${relId}/profile.md`
}

