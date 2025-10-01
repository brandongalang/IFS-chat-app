import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, InboxObservationStatus } from '@/lib/types/database'
import { observationBatchSchema, type ObservationBatch, type ObservationCandidate } from './observation-schema'
import type { InboxObservationAgent, InboxObservationAgentRunResult } from '@/mastra/agents/inbox-observation'
import {
  getInboxQueueSnapshot,
  getRecentObservationHistory,
  type InboxQueueSnapshot,
  type ObservationHistoryEntry,
} from '@/lib/data/inbox-queue'

type Supabase = SupabaseClient<Database>

export interface ObservationEngineOptions {
  supabase: Supabase
  agent: InboxObservationAgent
  userId: string
  queueLimit?: number
  dedupeWindowDays?: number
  now?: Date
  metadata?: Record<string, unknown>
}

export interface InsertedObservationSummary {
  id: string
  title: string
  semanticHash: string | null
  status: InboxObservationStatus
  createdAt: string
}

export type ObservationEngineStatus = 'success' | 'skipped' | 'error'

export interface ObservationEngineResult {
  status: ObservationEngineStatus
  queue: InboxQueueSnapshot
  inserted: InsertedObservationSummary[]
  reason?: string
  historyCount: number
  error?: Error
}

const DEFAULT_QUEUE_LIMIT = 3
const DEFAULT_LOOKBACK_DAYS = 14

export async function runObservationEngine(options: ObservationEngineOptions): Promise<ObservationEngineResult> {
  const { supabase, agent, userId } = options
  const queueLimit = options.queueLimit && options.queueLimit > 0 ? options.queueLimit : DEFAULT_QUEUE_LIMIT
  const lookbackDays = options.dedupeWindowDays && options.dedupeWindowDays > 0
    ? options.dedupeWindowDays
    : DEFAULT_LOOKBACK_DAYS
  const now = options.now ?? new Date()

  const queue = await getInboxQueueSnapshot(supabase, userId, { limit: queueLimit })
  if (!queue.hasCapacity) {
    return {
      status: 'skipped',
      queue,
      inserted: [],
      reason: 'queue_full',
      historyCount: 0,
    }
  }

  const history = await getRecentObservationHistory(supabase, userId, { lookbackDays })
  const historyHashes = new Set(history.map((entry) => entry.semanticHash).filter(Boolean) as string[])
  const remaining = Math.min(queue.available, queueLimit)

  if (remaining <= 0) {
    return {
      status: 'skipped',
      queue,
      inserted: [],
      reason: 'queue_full',
      historyCount: history.length,
    }
  }

  const prompt = buildAgentPrompt({ userId, history, remaining, now })

  let agentRun: InboxObservationAgentRunResult
  try {
    agentRun = await agent.run({
      input: prompt,
      context: {
        userId,
        maxObservations: remaining,
        metadata: options.metadata ?? {},
      },
    })
  } catch (error) {
    return {
      status: 'error',
      queue,
      inserted: [],
      reason: 'agent_failure',
      historyCount: history.length,
      error: error instanceof Error ? error : new Error('Unknown agent failure'),
    }
  }

  if (!agentRun || agentRun.status !== 'success' || !agentRun.output) {
    return {
      status: 'skipped',
      queue,
      inserted: [],
      reason: 'agent_empty',
      historyCount: history.length,
    }
  }

  const parsed = observationBatchSchema.safeParse(agentRun.output)
  if (!parsed.success) {
    const error = new Error('Failed to parse observation agent output')
    return {
      status: 'error',
      queue,
      inserted: [],
      reason: 'invalid_agent_payload',
      historyCount: history.length,
      error,
    }
  }

  const candidates = parsed.data.observations
  const filtered = filterObservationCandidates(candidates, historyHashes, remaining)

  if (!filtered.length) {
    return {
      status: 'skipped',
      queue,
      inserted: [],
      reason: 'no_candidates',
      historyCount: history.length,
    }
  }

  try {
    const inserted = await insertObservations({
      supabase,
      userId,
      candidates: filtered,
      now,
      metadata: options.metadata,
    })

    return {
      status: 'success',
      queue,
      inserted,
      historyCount: history.length,
    }
  } catch (error) {
    return {
      status: 'error',
      queue,
      inserted: [],
      reason: 'persistence_failure',
      historyCount: history.length,
      error: error instanceof Error ? error : new Error('Failed to persist observations'),
    }
  }
}

function buildAgentPrompt(input: {
  userId: string
  history: ObservationHistoryEntry[]
  remaining: number
  now: Date
}): string {
  const { userId, history, remaining, now } = input
  const header = `Generate up to ${remaining} fresh observations for user ${userId}. Only fill available inbox slots.`
  const historySummary = history.length
    ? history
        .slice(0, 10)
        .map((entry) => {
          const title = coerceString(entry.content?.title)
          const summary = coerceString(entry.content?.summary)
          const suffix = summary ? ` – ${summary}` : ''
          return `• ${entry.createdAt} ${title ?? entry.id}${suffix}`
        })
        .join('\n')
    : '• No recent observations in the last 14 days.'

  return `${header}

Context:
- Current timestamp: ${now.toISOString()}
- Queue availability: ${remaining}

Recent observations (dedupe window):
${historySummary}

Rules:
- Use the provided tools to gather check-ins, sessions, and markdown context.
- Skip generation entirely if there is no new, novel inference to offer.
- Output valid JSON matching the required schema.`
}

function filterObservationCandidates(
  candidates: ObservationBatch['observations'],
  historyHashes: Set<string>,
  remaining: number,
): Array<ObservationCandidate & { semanticHash: string }> {
  const seen = new Set<string>()
  const filtered: Array<ObservationCandidate & { semanticHash: string }> = []

  for (const candidate of candidates) {
    if (filtered.length >= remaining) break

    const hash = computeSemanticHash(candidate)
    if (!hash || historyHashes.has(hash) || seen.has(hash)) {
      continue
    }

    seen.add(hash)
    filtered.push({ ...candidate, semanticHash: hash })
  }

  return filtered
}

function computeSemanticHash(candidate: ObservationCandidate): string {
  const parts = [candidate.title.trim(), candidate.summary.trim(), candidate.inference.trim()]
  const timeframe = candidate.timeframe ?? {}
  if (timeframe.start) parts.push(`start:${timeframe.start}`)
  if (timeframe.end) parts.push(`end:${timeframe.end}`)
  if (Array.isArray(candidate.tags) && candidate.tags.length) {
    parts.push(candidate.tags.slice().sort().join('|'))
  }
  if (Array.isArray(candidate.relatedParts) && candidate.relatedParts.length) {
    const related = candidate.relatedParts.map((part) => part.partId).sort().join('|')
    parts.push(related)
  }

  return createHash('sha256').update(parts.join('::')).digest('hex')
}

interface InsertObservationsInput {
  supabase: Supabase
  userId: string
  candidates: Array<ObservationCandidate & { semanticHash: string }>
  now: Date
  metadata?: Record<string, unknown>
}

async function insertObservations(input: InsertObservationsInput): Promise<InsertedObservationSummary[]> {
  const { supabase, userId, candidates, now, metadata } = input
  const nowIso = now.toISOString()

  const rows = candidates.map((candidate) => ({
    user_id: userId,
    status: 'pending' as InboxObservationStatus,
    content: buildObservationContent(candidate),
    metadata: buildObservationMetadata(candidate, metadata),
    related_part_ids: Array.isArray(candidate.relatedParts)
      ? candidate.relatedParts.map((part) => part.partId)
      : [],
    semantic_hash: candidate.semanticHash,
    confidence: candidate.confidence ?? null,
    timeframe_start: candidate.timeframe?.start ?? null,
    timeframe_end: candidate.timeframe?.end ?? null,
    queued_at: nowIso,
    created_at: nowIso,
  }))

  const { data, error } = await supabase
    .from('inbox_observations')
    .insert(rows)
    .select('id,status,semantic_hash,created_at,content')

  if (error) {
    throw error
  }

  const inserted = data ?? []

  if (inserted.length) {
    const events = inserted.map((row) => ({
      observation_id: row.id,
      user_id: userId,
      event_type: 'generated' as const,
      payload: {
        semanticHash: row.semantic_hash,
        status: row.status,
        createdAt: row.created_at,
        context: metadata ?? {},
      },
    }))

    const { error: eventError } = await supabase.from('observation_events').insert(events)
    if (eventError) {
      throw eventError
    }
  }

  return inserted.map((row, index) => {
    const content = toRecord(row.content)
    return {
      id: row.id,
      title: coerceString(content.title) ?? candidates[index]?.title ?? row.id,
      semanticHash: (row as { semantic_hash?: string | null }).semantic_hash ?? candidates[index]?.semanticHash ?? null,
      status: row.status as InboxObservationStatus,
      createdAt: row.created_at,
    }
  })
}

function buildObservationContent(candidate: ObservationCandidate): Record<string, unknown> {
  return {
    title: candidate.title,
    summary: candidate.summary,
    body: candidate.inference,
    rationale: candidate.rationale ?? null,
    tags: candidate.tags ?? [],
    evidence: candidate.evidence ?? [],
  }
}

function buildObservationMetadata(
  candidate: ObservationCandidate & { semanticHash?: string },
  additional?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    kind: 'observation',
    insight_type: 'observation',
    inference: candidate.inference,
    rationale: candidate.rationale ?? null,
    confidence: candidate.confidence ?? null,
    tags: candidate.tags ?? [],
    relatedParts: candidate.relatedParts ?? [],
    timeframe: candidate.timeframe ?? null,
    evidence: candidate.evidence ?? [],
    semantic_hash: candidate.semanticHash ?? null,
    ...(additional ?? {}),
  }
}

function coerceString(candidate: unknown): string | null {
  if (typeof candidate === 'string' && candidate.trim().length) {
    return candidate.trim()
  }
  return null
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
