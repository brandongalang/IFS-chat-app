import { z } from 'zod'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import { sessionRowSchema, sessionTypeEnum, type SessionRowV2 } from './types'

function toIsoString(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    // Accept common Postgres formats and coerce to RFC3339
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
    return value // leave as-is; zod may still accept if already RFC3339
  }
  return null
}

function normalizeSessionRowDates(row: any): any {
  if (!row || typeof row !== 'object') return row
  const copy: any = { ...row }
  if ('started_at' in copy) copy.started_at = toIsoString(copy.started_at) ?? copy.started_at
  if ('ended_at' in copy && copy.ended_at != null) copy.ended_at = toIsoString(copy.ended_at) ?? copy.ended_at
  if ('last_message_at' in copy && copy.last_message_at != null)
    copy.last_message_at = toIsoString(copy.last_message_at) ?? copy.last_message_at
  if ('created_at' in copy) copy.created_at = toIsoString(copy.created_at) ?? copy.created_at
  if ('updated_at' in copy) copy.updated_at = toIsoString(copy.updated_at) ?? copy.updated_at
  return copy
}

function parseSessionRow(row: any): SessionRowV2 {
  const normalized = normalizeSessionRowDates(row)
  return sessionRowSchema.parse(normalized)
}

const createSessionInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: sessionTypeEnum.default('therapy'),
    metadata: z.record(z.any()).default({}),
    started_at: z.string().datetime().optional(),
  })
  .strict()

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>

const completeSessionInputSchema = z
  .object({
    summary: z.string().nullable().optional(),
    key_insights: z.array(z.string()).optional(),
    breakthroughs: z.array(z.string()).optional(),
    resistance_notes: z.array(z.string()).optional(),
    homework: z.array(z.string()).optional(),
    next_session: z.array(z.string()).optional(),
    parts_present: z.array(z.string().uuid()).optional(),
    observations: z.array(z.string().uuid()).optional(),
    ended_at: z.string().datetime().optional(),
  })
  .strict()

export type CompleteSessionInput = z.infer<typeof completeSessionInputSchema>

/**
 * Insert a new session for the current user with sensible defaults for metadata and timestamps.
 */
export async function createSession(
  input: CreateSessionInput,
  deps: PrdDataDependencies
): Promise<SessionRowV2> {
  const payload = createSessionInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)

  const { data, error } = await client
    .from('sessions_v2')
    .insert({
      ...payload,
      user_id: userId,
      started_at: payload.started_at ?? new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`)
  }

  return parseSessionRow(data)
}

/**
 * Append activity metadata to an existing session, requiring at least one meaningful change.
 */
export async function appendSessionActivity(
  sessionId: string,
  updates: { last_message_at?: string; observations?: string[] },
  deps: PrdDataDependencies
): Promise<SessionRowV2> {
  const { client, userId } = assertPrdDeps(deps)
  const patch: Record<string, unknown> = {}

  if (updates.last_message_at) {
    patch.last_message_at = updates.last_message_at
  }
  if (updates.observations && updates.observations.length > 0) {
    patch.observations = updates.observations
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No valid updates provided')
  }

  const { data, error } = await client
    .from('sessions_v2')
    .update(patch)
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update session ${sessionId}: ${error.message}`)
  }

  return parseSessionRow(data)
}

/**
 * Mark a session as completed while persisting summarization metadata.
 */
export async function completeSession(
  sessionId: string,
  input: CompleteSessionInput,
  deps: PrdDataDependencies
): Promise<SessionRowV2> {
  const payload = completeSessionInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)

  const { data, error } = await client
    .from('sessions_v2')
    .update({
      ...payload,
      ended_at: payload.ended_at ?? new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to complete session ${sessionId}: ${error.message}`)
  }

  return parseSessionRow(data)
}

/**
 * Fetch the most recent active session (without ended_at) for the current user.
 */
export async function getActiveSession(
  deps: PrdDataDependencies
): Promise<SessionRowV2 | null> {
  const { client, userId } = assertPrdDeps(deps)

  const { data, error } = await client
    .from('sessions_v2')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch active session: ${error.message}`)
  }

  if (!data) return null
  return parseSessionRow(data)
}

/**
 * Fetch a specific session by ID for the current user.
 */
export async function getSession(
  sessionId: string,
  deps: PrdDataDependencies
): Promise<SessionRowV2 | null> {
  const { client, userId } = assertPrdDeps(deps)

  const { data, error } = await client
    .from('sessions_v2')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch session ${sessionId}: ${error.message}`)
  }

  if (!data) return null
  return sessionRowSchema.parse(data)
}

/**
 * List recent sessions for the current user, ordered by start time (newest first).
 */
export async function listSessions(
  deps: PrdDataDependencies,
  limit: number = 10
): Promise<SessionRowV2[]> {
  const { client, userId } = assertPrdDeps(deps)

  const { data, error } = await client
    .from('sessions_v2')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list sessions: ${error.message}`)
  }

  return (data ?? []).map((row) => parseSessionRow(row))
}
