import { getServiceClient, type SupabaseDatabaseClient } from '@/lib/supabase/clients'
import type { Database } from '@/lib/types/database'

import type {
  ObservationTelemetryClient,
  SessionDetail,
  SessionDetailParams,
  SessionListItem,
  SessionListParams,
  SessionListResult,
  SessionSearchMatch,
  SessionSearchParams,
  SessionSearchResult,
} from './types'
import {
  extractSnippet,
  normalizeLookbackDays,
  normalizePageSize as normalizeMessagePageSize,
  normalizeResultLimit,
  resolveSinceDate,
  safeRecordTelemetry,
  toLower,
} from './utils'

type SessionRow = Database['public']['Tables']['sessions']['Row']
type SessionMessage = SessionRow['messages'][number]

const DEFAULT_LIST_LIMIT = 10
const MAX_SESSION_FETCH = 200
const SEARCH_FETCH_MULTIPLIER = 4

interface SessionSearchOptions {
  client?: SupabaseDatabaseClient
  telemetry?: ObservationTelemetryClient | null
}

function resolveClient(options: SessionSearchOptions | undefined): SupabaseDatabaseClient {
  return options?.client ?? getServiceClient()
}

function toListItem(row: Pick<SessionRow, 'id' | 'start_time' | 'end_time' | 'summary'>): SessionListItem {
  return {
    sessionId: row.id,
    startedAt: row.start_time,
    endedAt: row.end_time,
    summary: row.summary,
  }
}

function projectMessage(message: SessionMessage) {
  return {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  }
}

export async function listSessions(
  params: SessionListParams,
  options?: SessionSearchOptions,
): Promise<SessionListResult> {
  const startedAt = Date.now()
  const telemetry = options?.telemetry ?? null
  const client = resolveClient(options)

  const lookbackDays = normalizeLookbackDays(params.lookbackDays)
  const limit = normalizeResultLimit(params.limit, { fallback: DEFAULT_LIST_LIMIT })
  const fetchLimit = Math.min(limit + 1, MAX_SESSION_FETCH)
  const since = resolveSinceDate(lookbackDays).toISOString()

  try {
    const { data, error } = await client
      .from('sessions')
      .select('id,start_time,end_time,summary')
      .eq('user_id', params.userId)
      .gte('start_time', since)
      .order('start_time', { ascending: false })
      .limit(fetchLimit)

    if (error) throw error

    const rows = (data ?? []) as Array<Pick<SessionRow, 'id' | 'start_time' | 'end_time' | 'summary'>>
    const truncated = rows.length > limit
    const items = rows.slice(0, limit).map(toListItem)

    const runtimeMs = Math.max(0, Date.now() - startedAt)

    await safeRecordTelemetry(telemetry, {
      tool: 'sessions.list',
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
      tool: 'sessions.list',
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

export async function searchSessions(
  params: SessionSearchParams,
  options?: SessionSearchOptions,
): Promise<SessionSearchResult> {
  const startedAt = Date.now()
  const telemetry = options?.telemetry ?? null
  const client = resolveClient(options)

  const lookbackDays = normalizeLookbackDays(params.lookbackDays)
  const limit = normalizeResultLimit(params.limit, { fallback: DEFAULT_LIST_LIMIT })
  const fields = params.fields && params.fields.length > 0 ? params.fields : ['summary', 'messages']
  const fetchLimit = Math.min(limit * SEARCH_FETCH_MULTIPLIER, MAX_SESSION_FETCH)
  const since = resolveSinceDate(lookbackDays).toISOString()
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
      .from('sessions')
      .select('id,start_time,summary,messages')
      .eq('user_id', params.userId)
      .gte('start_time', since)
      .order('start_time', { ascending: false })
      .limit(fetchLimit)

    if (error) throw error

    const sessions = (data ?? []) as Array<Pick<SessionRow, 'id' | 'start_time' | 'summary' | 'messages'>>
    const matches: SessionSearchMatch[] = []
    let truncated = false

    for (const session of sessions) {
      if (matches.length >= limit) {
        truncated = true
        break
      }

      if (fields.includes('summary')) {
        const summarySnippet = extractSnippet(session.summary, queryNeedle)
        if (summarySnippet) {
          matches.push({
            sessionId: session.id,
            field: 'summary',
            snippet: summarySnippet,
            occurredAt: session.start_time,
            score: null,
          })
        }
      }

      if (matches.length >= limit) {
        truncated = true
        break
      }

      if (fields.includes('messages')) {
        const messages = Array.isArray(session.messages) ? session.messages : []
        for (const message of messages) {
          if (!message || typeof message.content !== 'string') continue
          const snippet = extractSnippet(message.content, queryNeedle)
          if (snippet) {
            matches.push({
              sessionId: session.id,
              field: message.role ?? 'message',
              snippet,
              occurredAt: session.start_time,
              score: null,
            })
          }
          if (matches.length >= limit) {
            truncated = true
            break
          }
        }
      }
    }

    if (!truncated && sessions.length >= fetchLimit) {
      truncated = true
    }

    const runtimeMs = Math.max(0, Date.now() - startedAt)

    await safeRecordTelemetry(telemetry, {
      tool: 'sessions.search',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        lookbackDays,
        limit,
        resultCount: matches.length,
        fields,
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
      tool: 'sessions.search',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        lookbackDays,
        limit,
        fields,
      },
      error: error instanceof Error ? error.message : 'unknown-error',
    })
    throw error
  }
}

export async function getSessionDetail(
  params: SessionDetailParams,
  options?: SessionSearchOptions,
): Promise<SessionDetail | null> {
  const startedAt = Date.now()
  const telemetry = options?.telemetry ?? null
  const client = resolveClient(options)

  const page = Math.max(1, params.page ?? 1)
  const pageSize = normalizeMessagePageSize(params.pageSize)

  try {
    const { data, error } = await client
      .from('sessions')
      .select('id,start_time,end_time,summary,messages')
      .eq('user_id', params.userId)
      .eq('id', params.sessionId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      const runtimeMs = Math.max(0, Date.now() - startedAt)
      await safeRecordTelemetry(telemetry, {
        tool: 'sessions.get',
        userId: params.userId,
        durationMs: runtimeMs,
        metadata: {
          sessionId: params.sessionId,
          page,
          pageSize,
        },
      })
      return null
    }

    const row = data as SessionRow
    const messages = Array.isArray(row.messages) ? row.messages : []
    const startIndex = (page - 1) * pageSize
    const slice = messages.slice(startIndex, startIndex + pageSize).map(projectMessage)
    const nextPage = startIndex + slice.length < messages.length ? page + 1 : null

    const detail: SessionDetail = {
      sessionId: row.id,
      startedAt: row.start_time,
      endedAt: row.end_time,
      summary: row.summary,
      messages: slice,
      nextPage,
    }

    const runtimeMs = Math.max(0, Date.now() - startedAt)

    await safeRecordTelemetry(telemetry, {
      tool: 'sessions.get',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        sessionId: params.sessionId,
        page,
        pageSize,
        totalMessages: messages.length,
      },
    })

    return detail
  } catch (error) {
    const runtimeMs = Math.max(0, Date.now() - startedAt)
    await safeRecordTelemetry(telemetry, {
      tool: 'sessions.get',
      userId: params.userId,
      durationMs: runtimeMs,
      metadata: {
        sessionId: params.sessionId,
        page,
        pageSize,
      },
      error: error instanceof Error ? error.message : 'unknown-error',
    })
    throw error
  }
}
