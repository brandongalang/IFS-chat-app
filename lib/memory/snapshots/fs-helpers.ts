import type { StorageAdapter, StorageAdapterFactoryOptions } from '../storage/adapter'

/**
 * Get the storage adapter for Memory V2 system.
 * Defaults to Supabase, but supports local adapters for tests and tooling.
 */
export async function getStorageAdapter(options?: StorageAdapterFactoryOptions): Promise<StorageAdapter> {
  const mode = (options?.mode ?? process.env.MEMORY_STORAGE_ADAPTER)?.toLowerCase()

  if (mode === 'local') {
    const { LocalFsStorageAdapter } = await import('../storage/local-fs-adapter')
    return new LocalFsStorageAdapter({ root: process.env.MEMORY_LOCAL_ROOT })
  }

  const { SupabaseStorageAdapter } = await import('../storage/supabase-storage-adapter')
  return new SupabaseStorageAdapter()
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

export function sessionTranscriptPath(userId: string, sessionId: string) {
  return `users/${userId}/sessions/${sessionId}/transcript.json`
}
