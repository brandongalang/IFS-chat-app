import { getServiceClient, type SupabaseDatabaseClient } from '@/lib/supabase/clients'
import type { Database } from '@/lib/types/database'

import type {
  CheckInDetail,
  CheckInDetailParams,
  CheckInListItem,
  CheckInListParams,
  CheckInListResult,
  CheckInSearchMatch,
  CheckInSearchParams,
  CheckInSearchResult,
  ObservationTelemetryClient,
} from './types'
import {
  extractSnippet,
  normalizeLookbackDays,
  normalizeResultLimit,
  resolveSinceDate,
  safeRecordTelemetry,
  toLower,
} from './utils'

type CheckInRow = Database['public']['Tables']['check_ins']['Row']

const DEFAULT_LIST_LIMIT = 10
const MAX_CHECKIN_FETCH = 200
const SEARCH_FETCH_MULTIPLIER = 4

interface CheckInSearchOptions {
  client?: SupabaseDatabaseClient
  telemetry?: ObservationTelemetryClient | null
}

function resolveClient(options: CheckInSearchOptions | undefined): SupabaseDatabaseClient {
  return options?.client ?? getServiceClient()
}

function toListItem(row: Pick<CheckInRow, 'id' | 'type' | 'check_in_date' | 'intention' | 'reflection'>): CheckInListItem {
  return {
    checkInId: row.id,
    type: row.type,
    date: row.check_in_date,
    intention: row.intention ?? null,
    reflection: row.reflection ?? null,
  }
}

export async function listCheckIns(
  params: CheckInListParams,
  options?: CheckInSearchOptions,
): Promise<CheckInListResult> {
  const startedAt = Date.now()
  const telemetry = options?.telemetry ?? null
  const client = resolveClient(options)

  const lookbackDays = normalizeLookbackDays(params.lookbackDays)
  const limit = normalizeResultLimit(params.limit, { fallback: DEFAULT_LIST_LIMIT })
  const fetchLimit = Math.min(limit + 1, MAX_CHECKIN_FETCH)
  const sinceDate = resolveSinceDate(lookbackDays)
  const since = sinceDate.toISOString().slice(0, 10)

  try {
    const { data, error } = await client
      .from('check_ins')
      .select('id,type,check_in_date,intention,reflection')
      .eq('user_id', params.userId)
      .gte('check_in_date', since)
      .order('check_in_date', { ascending: false })
      .limit(fetchLimit)

    if (error) throw error

    const rows = (data ?? []) as Array<Pick<CheckInRow, 'id' | 'type' | 'check_in_date' | 'intention' | 'reflection'>>
    const truncated = rows.length > limit
    const items = rows.slice(0, limit).map(toListItem)

    const runtimeMs = Math.max(0, Date.now() - startedAt)

    await safeRecordTelemetry(telemetry, {
      tool: 'checkins.list',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        lookbackDays,
        limit,
        resultCount: items.length,
      },
    })

    return {
      items,
      truncated,
      runtimeMs,
    }
  } catch (error) {
    const runtimeMs = Math.max(0, Date.now() - startedAt)
    await safeRecordTelemetry(telemetry, {
      tool: 'checkins.list',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        lookbackDays,
        limit,
      },
      error: error instanceof Error ? error.message : 'unknown-error',
    })
    throw error
  }
}

export async function searchCheckIns(
  params: CheckInSearchParams,
  options?: CheckInSearchOptions,
): Promise<CheckInSearchResult> {
  const startedAt = Date.now()
  const telemetry = options?.telemetry ?? null
  const client = resolveClient(options)

  const lookbackDays = normalizeLookbackDays(params.lookbackDays)
  const limit = normalizeResultLimit(params.limit, { fallback: DEFAULT_LIST_LIMIT })
  const fetchLimit = Math.min(limit * SEARCH_FETCH_MULTIPLIER, MAX_CHECKIN_FETCH)
  const sinceDate = resolveSinceDate(lookbackDays)
  const since = sinceDate.toISOString().slice(0, 10)
  const queryNeedle = toLower(params.query).trim()

  if (!queryNeedle.length) {
    return {
      matches: [],
      truncated: false,
      runtimeMs: Math.max(0, Date.now() - startedAt),
    }
  }

  try {
    const { data, error } = await client
      .from('check_ins')
      .select('id,type,check_in_date,intention,reflection,gratitude,parts_data,created_at')
      .eq('user_id', params.userId)
      .gte('check_in_date', since)
      .order('check_in_date', { ascending: false })
      .limit(fetchLimit)

    if (error) throw error

    const checkIns = (data ?? []) as Array<
      Pick<CheckInRow, 'id' | 'type' | 'check_in_date' | 'intention' | 'reflection' | 'gratitude' | 'parts_data' | 'created_at'>
    >
    const matches: CheckInSearchMatch[] = []
    let truncated = false

    for (const entry of checkIns) {
      if (matches.length >= limit) {
        truncated = true
        break
      }

      const sources: Array<string | null | undefined> = [entry.intention, entry.reflection, entry.gratitude]
      if (entry.parts_data != null) {
        try {
          sources.push(typeof entry.parts_data === 'string' ? entry.parts_data : JSON.stringify(entry.parts_data))
        } catch {
          // Ignore serialization issues.
        }
      }

      for (const source of sources) {
        const snippet = extractSnippet(source ?? '', queryNeedle)
        if (snippet) {
          matches.push({
            checkInId: entry.id,
            type: entry.type,
            date: entry.check_in_date,
            snippet,
            score: null,
          })
          break
        }
      }
    }

    if (!truncated && checkIns.length >= fetchLimit) {
      truncated = true
    }

    const runtimeMs = Math.max(0, Date.now() - startedAt)

    await safeRecordTelemetry(telemetry, {
      tool: 'checkins.search',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        lookbackDays,
        limit,
        resultCount: matches.length,
      },
    })

    return {
      matches: matches.slice(0, limit),
      truncated,
      runtimeMs,
    }
  } catch (error) {
    const runtimeMs = Math.max(0, Date.now() - startedAt)
    await safeRecordTelemetry(telemetry, {
      tool: 'checkins.search',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        lookbackDays,
        limit,
      },
      error: error instanceof Error ? error.message : 'unknown-error',
    })
    throw error
  }
}

export async function getCheckInDetail(
  params: CheckInDetailParams,
  options?: CheckInSearchOptions,
): Promise<CheckInDetail | null> {
  const startedAt = Date.now()
  const telemetry = options?.telemetry ?? null
  const client = resolveClient(options)

  try {
    const { data, error } = await client
      .from('check_ins')
      .select('id,type,check_in_date,intention,reflection,gratitude,parts_data,created_at,updated_at')
      .eq('user_id', params.userId)
      .eq('id', params.checkInId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      const runtimeMs = Math.max(0, Date.now() - startedAt)
      await safeRecordTelemetry(telemetry, {
        tool: 'checkins.get',
        userId: params.userId,
        durationMs: runtimeMs,
        metadata: {
          checkInId: params.checkInId,
        },
      })
      return null
    }

    const row = data as CheckInRow

    const detail: CheckInDetail = {
      checkInId: row.id,
      type: row.type,
      date: row.check_in_date,
      intention: row.intention ?? null,
      reflection: row.reflection ?? null,
      gratitude: row.gratitude ?? null,
      partsData: row.parts_data ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }

    const runtimeMs = Math.max(0, Date.now() - startedAt)

    await safeRecordTelemetry(telemetry, {
      tool: 'checkins.get',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        checkInId: params.checkInId,
      },
    })

    return detail
  } catch (error) {
    const runtimeMs = Math.max(0, Date.now() - startedAt)
    await safeRecordTelemetry(telemetry, {
      tool: 'checkins.get',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        checkInId: params.checkInId,
      },
      error: error instanceof Error ? error.message : 'unknown-error',
    })
    throw error
  }
}
