import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const pendingUpdateRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  kind: z.string(),
  payload: z.unknown(),
  summary: z.string().nullable(),
  created_at: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

export type MemoryUpdateRecord = {
  id: string
  userId: string
  kind: string
  summary: string | null
  createdAt: string
  payload: unknown
  metadata: Record<string, unknown>
}

export async function fetchPendingUpdates(userId: string, limit = 25): Promise<MemoryUpdateRecord[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('memory_updates')
    .select('id, user_id, kind, payload, summary, created_at, metadata')
    .eq('user_id', userId)
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch pending memory updates: ${error.message}`)
  }

  return (data || []).map((row) => {
    const parsed = pendingUpdateRowSchema.parse(row)
    return {
      id: parsed.id,
      userId: parsed.user_id,
      kind: parsed.kind,
      summary: parsed.summary ?? null,
      createdAt: parsed.created_at,
      payload: parsed.payload,
      metadata: typeof parsed.metadata === 'object' && parsed.metadata !== null && !Array.isArray(parsed.metadata)
        ? (parsed.metadata as Record<string, unknown>)
        : {},
    }
  })
}

export async function listUsersWithPendingUpdates(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('memory_updates')
    .select('user_id')
    .is('processed_at', null)

  if (error) {
    throw new Error(`Failed to list users with pending updates: ${error.message}`)
  }

  const ids = new Set<string>()
  for (const row of data || []) {
    if (row?.user_id) ids.add(row.user_id)
  }
  return Array.from(ids)
}

export async function markUpdatesProcessed(params: {
  userId: string
  updates: Array<{ id: string; summary?: string | null }>
  digest: string
}): Promise<{ updated: number; processedAt: string }> {
  if (!params.updates.length) {
    return { updated: 0, processedAt: new Date().toISOString() }
  }

  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()
  let updatedCount = 0

  for (const item of params.updates) {
    const { error } = await supabase
      .from('memory_updates')
      .update({
        processed_at: nowIso,
        processed_digest: params.digest,
        processed_summary: item.summary ?? null,
      })
      .eq('id', item.id)
      .eq('user_id', params.userId)
      .is('processed_at', null)

    if (error) {
      throw new Error(`Failed to mark update ${item.id} processed: ${error.message}`)
    }
    updatedCount += 1
  }

  return { updated: updatedCount, processedAt: nowIso }
}

export async function hasPendingUpdates(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('memory_updates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('processed_at', null)
    .limit(1)

  if (error) {
    throw new Error(`Failed to count pending updates: ${error.message}`)
  }

  return typeof count === 'number' && count > 0
}

