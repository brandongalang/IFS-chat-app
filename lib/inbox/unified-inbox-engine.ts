/**
 * Unified Inbox Engine
 * 
 * Processes output from UnifiedInboxAgent and inserts into inbox_items table.
 * Supports all 6 output types: session_summary, nudge, follow_up, observation, question, pattern.
 * 
 * Replaces the observation-engine for new inbox generation workflows.
 */

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'
import {
  unifiedInboxBatchSchema,
  type UnifiedInboxItemCandidate,
  type UnifiedInboxBatch,
  buildUnifiedItemContent,
  buildUnifiedItemMetadata,
} from './unified-inbox-schema'
import type { UnifiedInboxAgent } from '@/mastra/agents/unified-inbox'
import { getInboxQueueSnapshot, getRecentObservationHistory } from '@/lib/data/inbox-queue'
import type { InboxQueueSnapshot, ObservationHistoryEntry } from '@/lib/data/inbox-queue'

type Supabase = SupabaseClient<Database>

export interface UnifiedInboxEngineOptions {
  supabase: Supabase
  agent: UnifiedInboxAgent
  userId: string
  queueLimit?: number
  dedupeWindowDays?: number
  now?: Date
  metadata?: Record<string, unknown>
  telemetry?: {
    enabled?: boolean
    runId?: string
  }
}

export interface InsertedInboxItemSummary {
  id: string
  type: string
  title: string
  semanticHash: string | null
  status: string
  createdAt: string
}

export type UnifiedInboxEngineStatus = 'success' | 'skipped' | 'error'

export interface UnifiedInboxEngineResult {
  status: UnifiedInboxEngineStatus
  queue: InboxQueueSnapshot
  inserted: InsertedInboxItemSummary[]
  reason?: string
  historyCount: number
  error?: Error
}

const DEFAULT_QUEUE_LIMIT = 5
const DEFAULT_LOOKBACK_DAYS = 14

/**
 * Run the unified inbox engine to generate and insert inbox items.
 * 
 * Process:
 * 1. Check queue capacity
 * 2. Fetch deduplication history
 * 3. Run unified agent to generate items
 * 4. Parse and validate output
 * 5. Filter duplicates
 * 6. Insert into inbox_items table
 */
export async function runUnifiedInboxEngine(
  options: UnifiedInboxEngineOptions,
): Promise<UnifiedInboxEngineResult> {
  const { supabase, agent, userId } = options
  const queueLimit = (options.queueLimit && options.queueLimit > 0) ? options.queueLimit : DEFAULT_QUEUE_LIMIT
  const lookbackDays = (options.dedupeWindowDays && options.dedupeWindowDays > 0)
    ? options.dedupeWindowDays
    : DEFAULT_LOOKBACK_DAYS
  const now = options.now ?? new Date()
  const requestId =
    options.metadata && typeof (options.metadata as any).requestId === 'string'
      ? ((options.metadata as any).requestId as string)
      : null

  // Step 1: Check queue capacity
  const queue = await getInboxQueueSnapshot(supabase, userId, { limit: queueLimit })
  if (options.telemetry?.enabled) {
    await supabase.from('inbox_observation_telemetry').insert({
      user_id: userId,
      tool: 'unified_inbox_engine.queue_snapshot',
      duration_ms: 0,
      metadata: {
        runId: options.telemetry?.runId ?? null,
        requestId,
        total: queue.total,
        available: queue.available,
        limit: queue.limit,
        hasCapacity: queue.hasCapacity,
      },
    })
  }

  if (!queue.hasCapacity) {
    return {
      status: 'skipped',
      queue,
      inserted: [],
      reason: 'queue_full',
      historyCount: 0,
    }
  }

  // Step 2: Fetch deduplication history
  const history = await getRecentObservationHistory(supabase, userId, { lookbackDays })
  if (options.telemetry?.enabled) {
    await supabase.from('inbox_observation_telemetry').insert({
      user_id: userId,
      tool: 'unified_inbox_engine.history_summary',
      duration_ms: 0,
      metadata: {
        runId: options.telemetry?.runId ?? null,
        requestId,
        historyCount: history.length,
      },
    })
  }

  const historyHashes = new Set(history.map((e) => e.semanticHash).filter(Boolean) as string[])
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

  // Step 3: Run unified agent
  const prompt = buildUnifiedAgentPrompt({ userId, history, remaining, now })

  let agentRun: { status: string; output?: unknown }
  try {
    const agentStartedAt = Date.now()
    if (options.telemetry?.enabled) {
      await supabase.from('inbox_observation_telemetry').insert({
        user_id: userId,
        tool: 'unified_inbox_agent.invoke',
        duration_ms: 0,
        metadata: { runId: options.telemetry?.runId ?? null, requestId },
      })
    }

    agentRun = await agent.run({
      input: prompt,
      context: {
        userId,
        maxItems: remaining,
        metadata: options.metadata ?? {},
      },
    })

    if (options.telemetry?.enabled) {
      await supabase.from('inbox_observation_telemetry').insert({
        user_id: userId,
        tool: 'unified_inbox_agent.output_received',
        duration_ms: Date.now() - agentStartedAt,
        metadata: {
          runId: options.telemetry?.runId ?? null,
          requestId,
          status: agentRun?.status ?? 'unknown',
          hasOutput: Boolean(agentRun?.output),
        },
      })
    }
  } catch (error) {
    if (options.telemetry?.enabled) {
      await supabase.from('inbox_observation_telemetry').insert({
        user_id: userId,
        tool: 'unified_inbox_agent.error',
        duration_ms: 0,
        metadata: { runId: options.telemetry?.runId ?? null, requestId },
        error: error instanceof Error ? error.message : 'unknown agent failure',
      })
    }
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

  // Step 4: Parse and validate output
  const parsed = unifiedInboxBatchSchema.safeParse(agentRun.output)
  if (!parsed.success) {
    const error = new Error('Failed to parse unified inbox agent output')
    if (options.telemetry?.enabled) {
      await supabase.from('inbox_observation_telemetry').insert({
        user_id: userId,
        tool: 'unified_inbox_engine.parse.error',
        duration_ms: 0,
        metadata: { runId: options.telemetry?.runId ?? null, requestId },
        error: error.message,
      })
    }
    return {
      status: 'error',
      queue,
      inserted: [],
      reason: 'invalid_agent_payload',
      historyCount: history.length,
      error,
    }
  }

  // Step 5: Filter duplicates
  const candidates = parsed.data.items
  const filtered = filterInboxCandidates(candidates, historyHashes, remaining)
  if (options.telemetry?.enabled) {
    await supabase.from('inbox_observation_telemetry').insert({
      user_id: userId,
      tool: 'unified_inbox_engine.filter.summary',
      duration_ms: 0,
      metadata: {
        runId: options.telemetry?.runId ?? null,
        requestId,
        candidateCount: (candidates ?? []).length,
        filteredCount: filtered.length,
        remaining,
      },
    })
  }

  if (!filtered.length) {
    if (options.telemetry?.enabled) {
      await supabase.from('inbox_observation_telemetry').insert({
        user_id: userId,
        tool: 'unified_inbox_engine.no_candidates',
        duration_ms: 0,
        metadata: { runId: options.telemetry?.runId ?? null, requestId },
      })
    }
    return {
      status: 'skipped',
      queue,
      inserted: [],
      reason: 'no_candidates',
      historyCount: history.length,
    }
  }

  // Step 6: Insert into inbox_items table
  try {
    const inserted = await insertUnifiedInboxItems({
      supabase,
      userId,
      candidates: filtered,
      now,
      metadata: options.metadata,
    })

    if (options.telemetry?.enabled) {
      await supabase.from('inbox_observation_telemetry').insert({
        user_id: userId,
        tool: 'unified_inbox_engine.persist.success',
        duration_ms: 0,
        metadata: {
          runId: options.telemetry?.runId ?? null,
          requestId,
          insertedCount: inserted.length,
          typeBreakdown: Object.fromEntries(
            candidates
              .reduce((acc, c) => {
                const key = c.type
                acc.set(key, (acc.get(key) ?? 0) + 1)
                return acc
              }, new Map<string, number>())
              .entries()
          ),
        },
      })
    }

    return {
      status: 'success',
      queue,
      inserted,
      historyCount: history.length,
    }
  } catch (error) {
    if (options.telemetry?.enabled) {
      await supabase.from('inbox_observation_telemetry').insert({
        user_id: userId,
        tool: 'unified_inbox_engine.persist.error',
        duration_ms: 0,
        metadata: { runId: options.telemetry?.runId ?? null, requestId },
        error: error instanceof Error ? error.message : 'Failed to persist items',
      })
    }
    return {
      status: 'error',
      queue,
      inserted: [],
      reason: 'persistence_failure',
      historyCount: history.length,
      error: error instanceof Error ? error : new Error('Failed to persist items'),
    }
  }
}

/**
 * Build prompt for unified agent.
 * Includes context about queue capacity and recent history.
 */
function buildUnifiedAgentPrompt(input: {
  userId: string
  history: ObservationHistoryEntry[]
  remaining: number
  now: Date
}): string {
  const { userId, history, remaining, now } = input
  const header = `Generate up to ${remaining} fresh inbox items for user ${userId}. Only fill available slots.`
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
    : '• No recent items in the last 14 days.'

  return `${header}

Context:
- Current timestamp: ${now.toISOString()}
- Queue availability: ${remaining} slots
- User ID: ${userId}

Recent items (dedupe window):
${historySummary}

Supported Types:
1. session_summary - Key themes/breakthroughs from a recent session
2. nudge - Gentle hypothesis about parts/dynamics (2-3 sentences)
3. follow_up - Integration prompt after meaningful moment
4. observation - Therapy-grounded inference with evidence references
5. question - Curious probe inviting exploration
6. pattern - Synthesized insight across multiple evidence types

Rules:
- Use provided tools to research sessions, parts, therapy data, check-ins
- Skip generation if no novel, compelling insight to offer
- Output valid JSON matching the unified inbox schema
- For observations/patterns, include evidence with {type, id, context}
- For nudge/follow_up, use 'body' field
- For observation/question, use 'inference' field
- Maximum 6 items per batch`
}

/**
 * Filter duplicate candidates based on semantic hash.
 */
function filterInboxCandidates(
  candidates: UnifiedInboxItemCandidate[],
  historyHashes: Set<string>,
  remaining: number,
): Array<UnifiedInboxItemCandidate & { semanticHash: string }> {
  const seen = new Set<string>()
  const filtered: Array<UnifiedInboxItemCandidate & { semanticHash: string }> = []

  for (const candidate of candidates) {
    if (filtered.length >= remaining) break

    const hash = computeUnifiedSemanticHash(candidate)
    if (historyHashes.has(hash) || seen.has(hash)) {
      continue
    }

    seen.add(hash)
    filtered.push({ ...candidate, semanticHash: hash })
  }

  return filtered
}

/**
 * Compute semantic hash for deduplication.
 * Includes type, title, summary, and evidence references.
 */
function computeUnifiedSemanticHash(item: UnifiedInboxItemCandidate): string {
  const parts = [
    item.type,
    item.title.trim(),
    item.summary.trim(),
    item.body ?? '',
    item.inference ?? '',
  ]

  if (item.relatedPartIds?.length) {
    parts.push(`parts:${item.relatedPartIds.sort().join('|')}`)
  }

  if (item.sourceSessionIds?.length) {
    parts.push(`sessions:${item.sourceSessionIds.sort().join('|')}`)
  }

  if (item.evidence?.length) {
    const evidenceStr = item.evidence
      .map((e) => `${e.type}:${e.id}`)
      .sort()
      .join('|')
    parts.push(`evidence:${evidenceStr}`)
  }

  return createHash('sha256').update(parts.join('::')).digest('hex')
}

/**
 * Insert unified inbox items into inbox_items table.
 */
async function insertUnifiedInboxItems(input: {
  supabase: Supabase
  userId: string
  candidates: Array<UnifiedInboxItemCandidate & { semanticHash: string }>
  now: Date
  metadata?: Record<string, unknown>
}): Promise<InsertedInboxItemSummary[]> {
  const { supabase, userId, candidates, now, metadata } = input
  const nowIso = now.toISOString()

  const rows = candidates.map((item) => ({
    user_id: userId,
    type: item.type,
    status: 'pending' as const,
    content: buildUnifiedItemContent(item),
    metadata: buildUnifiedItemMetadata(item, metadata),
    evidence: item.evidence ?? null,
    related_part_ids: item.relatedPartIds ?? [],
    source_session_ids: item.sourceSessionIds ?? [],
    confidence: item.confidence ?? null,
    semantic_hash: item.semanticHash,
    source_type: 'unified_inbox_generated' as const,
    created_at: nowIso,
    queued_at: nowIso,
  }))

  const { data, error } = await supabase
    .from('inbox_items')
    .insert(rows)
    .select('id, type, status, semantic_hash, created_at, content')

  if (error) {
    throw error
  }

  const inserted = data ?? []

  return inserted.map((row, index) => {
    const content = toRecord(row.content)
    return {
      id: row.id,
      type: candidates[index]?.type ?? 'observation',
      title: coerceString(content.title) ?? candidates[index]?.title ?? row.id,
      semanticHash: (row as { semantic_hash?: string | null }).semantic_hash ?? candidates[index]?.semanticHash ?? null,
      status: row.status,
      createdAt: row.created_at,
    }
  })
}

/**
 * Helper: Coerce unknown value to string
 */
function coerceString(candidate: unknown): string | null {
  if (typeof candidate === 'string' && candidate.trim().length) {
    return candidate.trim()
  }
  return null
}

/**
 * Helper: Convert JSONB to record
 */
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

export type { UnifiedInboxBatch }
