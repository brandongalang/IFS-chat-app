import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, InboxObservationStatus } from '@/lib/types/database'
import {
  observationBatchSchema,
  type ObservationBatch,
  type ObservationCandidate,
  type ObservationEvidence,
} from './observation-schema'
import type { InboxObservationAgent, InboxObservationAgentRunResult } from '@/mastra/agents/inbox-observation'
import {
  getInboxQueueSnapshot,
  getRecentObservationHistory,
  type InboxQueueSnapshot,
  type ObservationHistoryEntry,
} from '@/lib/data/inbox-queue'
import {
  getCheckInDetail,
  getSessionDetail,
  readMarkdown,
  type CheckInDetail,
  type SessionDetail,
} from '@/lib/inbox/search'

type Supabase = SupabaseClient<Database>

export interface ObservationEngineOptions {
  supabase: Supabase
  agent: InboxObservationAgent
  userId: string
  queueLimit?: number
  dedupeWindowDays?: number
  now?: Date
  metadata?: Record<string, unknown>
  traceResolvers?: Partial<ObservationTraceResolvers> | null
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

type ObservationCandidateWithHash = ObservationCandidate & { semanticHash: string }

interface ObservationTrace {
  markdown?: Array<{ path: string; snippet?: string; hasMore?: boolean; error?: string }>
  sessions?: Array<{ sessionId: string; summary: string | null; messageCount: number; hasMore: boolean; error?: string }>
  checkIns?: Array<{ checkInId: string; type: string | null; date: string | null; intention: string | null; reflection: string | null; error?: string }>
}

interface ObservationTraceResolvers {
  readMarkdown: typeof readMarkdown
  getSessionDetail: typeof getSessionDetail
  getCheckInDetail: typeof getCheckInDetail
}

const defaultTraceResolvers: ObservationTraceResolvers = {
  readMarkdown,
  getSessionDetail,
  getCheckInDetail,
}

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

  const traceResolvers = options.traceResolvers === null
    ? null
    : resolveTraceResolvers(options.traceResolvers)
  const augmentedCandidates: ObservationCandidateWithHash[] = await Promise.all(
    filtered.map(async (candidate) => {
      const trace = await buildObservationTrace(options.userId, candidate, traceResolvers)
      if (!trace) {
        return candidate
      }
      const metadata = {
        ...(candidate.metadata ?? {}),
        trace,
      }
      return { ...candidate, metadata }
    }),
  )

  if (!augmentedCandidates.length) {
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
      candidates: augmentedCandidates,
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
- Output valid JSON matching the required schema.

Classification Guidance:
Observations will be automatically classified as:
- Question: Only if the title/summary/inference ends with "?" or clearly asks a question
  - Avoid: "How to build a habit" or "What we learned this week" (these are NOT questions)
  - Include: "What did I miss?" or "When should I exercise?" (clear interrogatives with ?)
- Label: If identifying patterns, types, categories (e.g., "Pattern detected: recurring late-night browsing")
- Observation: Default for insights, reflections, and learnings without question marks`
}

function filterObservationCandidates(
  candidates: ObservationBatch['observations'],
  historyHashes: Set<string>,
  remaining: number,
): ObservationCandidateWithHash[] {
  const seen = new Set<string>()
  const filtered: ObservationCandidateWithHash[] = []

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
  candidates: ObservationCandidateWithHash[]
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
  const classification = computeMessageClassification(candidate)
  return {
    kind: 'observation',
    insight_type: 'observation',
    classification,
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

function resolveTraceResolvers(overrides?: Partial<ObservationTraceResolvers>): ObservationTraceResolvers {
  return {
    readMarkdown: overrides?.readMarkdown ?? defaultTraceResolvers.readMarkdown,
    getSessionDetail: overrides?.getSessionDetail ?? defaultTraceResolvers.getSessionDetail,
    getCheckInDetail: overrides?.getCheckInDetail ?? defaultTraceResolvers.getCheckInDetail,
  }
}

export async function buildObservationTrace(
  userId: string,
  candidate: ObservationCandidate,
  resolvers: ObservationTraceResolvers | null = defaultTraceResolvers,
): Promise<ObservationTrace | null> {
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
    return null
  }

  if (!resolvers) {
    return null
  }

  const markdownEntries: ObservationTrace['markdown'] = []
  const sessionEntries: ObservationTrace['sessions'] = []
  const checkInEntries: ObservationTrace['checkIns'] = []

  const seenMarkdownPaths = new Set<string>()
  const seenSessions = new Set<string>()
  const seenCheckIns = new Set<string>()

  const evidenceList = candidate.evidence ?? []

  for (const evidence of evidenceList) {
    await Promise.all([
      handleMarkdownEvidence(userId, evidence, resolvers, seenMarkdownPaths, markdownEntries),
      handleSessionEvidence(userId, evidence, resolvers, seenSessions, sessionEntries),
      handleCheckInEvidence(userId, evidence, resolvers, seenCheckIns, checkInEntries),
    ])
  }

  const trace: ObservationTrace = {}
  if (markdownEntries.length) trace.markdown = markdownEntries
  if (sessionEntries.length) trace.sessions = sessionEntries
  if (checkInEntries.length) trace.checkIns = checkInEntries

  return Object.keys(trace).length ? trace : null
}

async function handleMarkdownEvidence(
  userId: string,
  evidence: ObservationEvidence,
  resolvers: ObservationTraceResolvers,
  seen: Set<string>,
  bucket: NonNullable<ObservationTrace['markdown']>,
) {
  const path = extractMarkdownPath(evidence)
  if (!path || seen.has(path)) return
  seen.add(path)

  try {
    const chunk = await resolvers.readMarkdown({ userId, path, offset: 0, limit: 512 })
    const snippet = chunk.data.length > 400 ? `${chunk.data.slice(0, 400)}…` : chunk.data
    bucket.push({ path, snippet, hasMore: chunk.hasMore })
  } catch (error) {
    bucket.push({
      path,
      error: error instanceof Error ? error.message : 'Failed to read markdown snippet',
    })
  }
}

async function handleSessionEvidence(
  userId: string,
  evidence: ObservationEvidence,
  resolvers: ObservationTraceResolvers,
  seen: Set<string>,
  bucket: NonNullable<ObservationTrace['sessions']>,
) {
  const sessionId = evidence.sessionId
  if (!sessionId || seen.has(sessionId)) return
  seen.add(sessionId)

  try {
    const detail: SessionDetail | null = await resolvers.getSessionDetail({
      userId,
      sessionId,
      page: 1,
      pageSize: 10,
    })
    if (!detail) {
      bucket.push({
        sessionId,
        summary: null,
        messageCount: 0,
        hasMore: false,
      })
      return
    }
    bucket.push({
      sessionId,
      summary: detail.summary ?? null,
      messageCount: detail.messages.length,
      hasMore: detail.nextPage !== null,
    })
  } catch (error) {
    bucket.push({
      sessionId,
      summary: null,
      messageCount: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : 'Failed to load session detail',
    })
  }
}

async function handleCheckInEvidence(
  userId: string,
  evidence: ObservationEvidence,
  resolvers: ObservationTraceResolvers,
  seen: Set<string>,
  bucket: NonNullable<ObservationTrace['checkIns']>,
) {
  const checkInId = evidence.checkInId
  if (!checkInId || seen.has(checkInId)) return
  seen.add(checkInId)

  try {
    const detail: CheckInDetail | null = await resolvers.getCheckInDetail({ userId, checkInId })
    if (!detail) {
      bucket.push({
        checkInId,
        type: null,
        date: null,
        intention: null,
        reflection: null,
      })
      return
    }
    bucket.push({
      checkInId: detail.checkInId,
      type: detail.type ?? null,
      date: detail.date ?? null,
      intention: detail.intention ?? null,
      reflection: detail.reflection ?? null,
    })
  } catch (error) {
    bucket.push({
      checkInId,
      type: null,
      date: null,
      intention: null,
      reflection: null,
      error: error instanceof Error ? error.message : 'Failed to load check-in detail',
    })
  }
}

function extractMarkdownPath(evidence: ObservationEvidence): string | null {
  const metadata = evidence.metadata
  if (metadata && typeof metadata === 'object') {
    const record = metadata as Record<string, unknown>
    const pathCandidate =
      record.markdownPath ?? record.path ?? record.sourcePath ?? record.markdown_file ?? record.file
    if (typeof pathCandidate === 'string' && pathCandidate.trim().length) {
      return sanitizeMarkdownPath(pathCandidate)
    }
  }

  if (typeof evidence.source === 'string' && evidence.source.startsWith('markdown:')) {
    const fragment = evidence.source.slice('markdown:'.length)
    const path = fragment.split('#')[0]?.trim()
    if (path) {
      return sanitizeMarkdownPath(path)
    }
  }

  return null
}

function sanitizeMarkdownPath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, '')
  return trimmed
}

export type MessageClassification = 'Observation' | 'Question' | 'Label'

function computeMessageClassification(candidate: ObservationCandidate): MessageClassification {
  const { title, summary, inference, tags } = candidate
  const fields = [title, summary, inference].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )

  // Check if any field contains a question mark
  const hasQuestionMark = fields.some((f) => f.includes('?'))

  // Negative patterns that should NOT be questions (even with ?)
  const nonQuestionPatterns = [
    /^\s*how to\b/i,
    /^\s*what\s+(we|i)\s+(learned|noticed|found)\b/i,
  ]

  const isNonQuestionPhrase = fields.some((f) =>
    nonQuestionPatterns.some((pattern) => pattern.test(f))
  )

  // Only classify as Question if it has "?" AND is not a negative pattern
  if (hasQuestionMark && !isNonQuestionPhrase) {
    return 'Question'
  }

  // Label detection
  const text = `${title ?? ''} ${summary ?? ''} ${inference ?? ''}`.toLowerCase()
  const isLabel =
    /\b(pattern|type|kind|category|class|label|identify|recognize)\b/.test(text) ||
    (Array.isArray(tags) &&
      tags.some((tag) => {
        const t = tag?.toLowerCase?.() ?? ''
        return t.includes('pattern') || t.includes('type')
      }))

  if (isLabel) {
    return 'Label'
  }

  // Default to Observation
  return 'Observation'
}

export type { ObservationTrace, ObservationTraceResolvers, MessageClassification }

