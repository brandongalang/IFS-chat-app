import { getStorageMode } from '../config'
import type { StorageAdapter } from '../storage/adapter'

export async function getStorageAdapter(): Promise<StorageAdapter> {
  const mode = getStorageMode()
  if (mode === 'supabase') {
    const { SupabaseStorageAdapter } = await import('../storage/supabase-storage-adapter')
    return new SupabaseStorageAdapter()
  }
  if (typeof window !== 'undefined') {
    throw new Error('Local filesystem storage is server-only. Avoid calling snapshot storage from client code.')
  }
  const { LocalFsStorageAdapter } = await import('../storage/local-fs-adapter')
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

export function sessionTranscriptPath(userId: string, sessionId: string) {
  return `users/${userId}/sessions/${sessionId}.json`
}

