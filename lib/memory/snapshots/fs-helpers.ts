import type { StorageAdapter } from '../storage/adapter'

/**
 * Get the storage adapter for Memory V2 system.
 * Always returns Supabase Storage adapter for production reliability.
 */
export async function getStorageAdapter(): Promise<StorageAdapter> {
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
