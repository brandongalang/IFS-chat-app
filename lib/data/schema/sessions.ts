import { z } from 'zod'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import { sessionRowSchema, sessionTypeEnum, type SessionRowV2 } from './types'

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

  return sessionRowSchema.parse(data)
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

  return sessionRowSchema.parse(data)
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

  return sessionRowSchema.parse(data)
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
  return sessionRowSchema.parse(data)
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

  return (data ?? []).map((row) => sessionRowSchema.parse(row))
}
