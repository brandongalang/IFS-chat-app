import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, InboxObservationRow, InboxObservationStatus } from '@/lib/types/database'

const DEFAULT_QUEUE_LIMIT = 3
const ACTIVE_STATUSES: string[] = ['pending', 'revealed', 'queued']

export interface InboxQueueSnapshot {
  total: number
  available: number
  limit: number
  hasCapacity: boolean
}

export interface GetQueueOptions {
  limit?: number
  statuses?: string[]
}

export interface ObservationHistoryEntry {
  id: string
  status: InboxObservationStatus
  semanticHash: string | null
  createdAt: string
  content: Record<string, unknown>
  metadata: Record<string, unknown>
  timeframeStart: string | null
  timeframeEnd: string | null
  confidence: number | null
}

export interface ObservationHistoryOptions {
  lookbackDays?: number
  limit?: number
}

type Supabase = SupabaseClient<Database>

export async function getInboxQueueSnapshot(
  supabase: Supabase,
  userId: string,
  options: GetQueueOptions = {},
): Promise<InboxQueueSnapshot> {
  const limit = options.limit && options.limit > 0 ? options.limit : DEFAULT_QUEUE_LIMIT
  const statuses = options.statuses && options.statuses.length ? options.statuses : ACTIVE_STATUSES

  const { count, error } = await supabase
    .from('inbox_items_view')
    .select('source_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', statuses)

  if (error) {
    throw error
  }

  const total = typeof count === 'number' ? count : 0
  const available = Math.max(0, limit - total)

  return {
    total,
    available,
    limit,
    hasCapacity: available > 0,
  }
}

export async function getRecentObservationHistory(
  supabase: Supabase,
  userId: string,
  options: ObservationHistoryOptions = {},
): Promise<ObservationHistoryEntry[]> {
  const lookbackDays = options.lookbackDays && options.lookbackDays > 0 ? options.lookbackDays : 14
  const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50

  const since = new Date()
  since.setDate(since.getDate() - lookbackDays)
  const sinceIso = since.toISOString()

  const { data, error } = await supabase
    .from('inbox_observations')
    .select(
      'id,status,semantic_hash,created_at,content,metadata,timeframe_start,timeframe_end,confidence',
    )
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data as InboxObservationRow[] | null)?.map((row) => ({
    id: row.id,
    status: row.status,
    semanticHash: row.semantic_hash,
    createdAt: row.created_at,
    content: toRecord(row.content),
    metadata: toRecord(row.metadata),
    timeframeStart: row.timeframe_start,
    timeframeEnd: row.timeframe_end,
    confidence: row.confidence,
  })) ?? []
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return { value }
    }
  }

  return {}
}
