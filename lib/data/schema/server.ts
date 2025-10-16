import 'server-only'

import { getServerSupabaseClient } from '@/lib/supabase/clients'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import {
  type SearchPartsInput,
  type UpsertPartInput,
  type CreateObservationInput,
  type ListObservationsInput,
  type CreateSessionInput,
  type CompleteSessionInput,
  type UpsertRelationshipInput,
  type CreateTimelineEventInput,
  type PartRowV2,
  type ObservationRow,
  type SessionRowV2,
  type PartRelationshipRowV2,
  type TimelineEventRow,
  type PartDisplayRow,
  type TimelineDisplayRow,
  type UserContextCacheRow,
  searchPartsV2,
  getPartByIdV2,
  upsertPartV2,
  deletePartV2,
  createObservation,
  listObservations,
  updateObservationFollowUp,
  createSession,
  appendSessionActivity,
  completeSession,
  getActiveSession,
  upsertRelationship,
  listRelationships,
  createTimelineEvent,
  listTimelineEvents,
  listPartsDisplay,
  getPartDisplay,
  listTimelineDisplay,
  getUserContextCache,
  refreshUserContextCache,
} from './index'

export type PrdServerDeps = {
  userId: string
  client?: SupabaseDatabaseClient
}

/**
 * Resolve Supabase dependencies for server-side data access, injecting defaults when omitted.
 */
async function resolveDeps(deps: PrdServerDeps): Promise<{ client: SupabaseDatabaseClient; userId: string }> {
  if (!deps?.userId) {
    throw new Error('userId is required for PRD data operations')
  }
  const client = deps.client ?? (await getServerSupabaseClient())
  return { client, userId: deps.userId }
}

/**
 * Log schema operation for observability.
 */
function logOperation(operation: string, params?: Record<string, any>) {
  const timestamp = new Date().toISOString()
  console.log(`[prd-schema] ${timestamp} ${operation}`, params ? JSON.stringify(params, null, 2) : '')
}

/**
 * Server helper to search parts using the shared schema-based implementation.
 */
export async function searchParts(input: SearchPartsInput, deps: PrdServerDeps): Promise<PartRowV2[]> {
  const startTime = Date.now()
  const resolved = await resolveDeps(deps)
  logOperation('searchParts', { query: input.query, limit: input.limit, userId: deps.userId })
  try {
    const result = await searchPartsV2(input, resolved)
    const duration = Date.now() - startTime
    console.log(`[prd-schema] searchParts completed in ${duration}ms, found ${result.length} parts`)
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[prd-schema] searchParts failed in ${duration}ms:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}

/**
 * Server helper to fetch a single part by ID.
 */
export async function getPart(partId: string, deps: PrdServerDeps): Promise<PartRowV2 | null> {
  const resolved = await resolveDeps(deps)
  return getPartByIdV2(partId, resolved)
}

/**
 * Server helper to create or update a part record.
 */
export async function upsertPart(input: UpsertPartInput, deps: PrdServerDeps): Promise<PartRowV2> {
  const startTime = Date.now()
  const resolved = await resolveDeps(deps)
  logOperation('upsertPart', { id: input.id, name: input.name, category: input.category, userId: deps.userId })
  try {
    const result = await upsertPartV2(input, resolved)
    const duration = Date.now() - startTime
    console.log(`[prd-schema] upsertPart completed in ${duration}ms: ${result.id}`)
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[prd-schema] upsertPart failed in ${duration}ms:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}

/**
 * Server helper to delete a part record.
 */
export async function removePart(partId: string, deps: PrdServerDeps): Promise<void> {
  const resolved = await resolveDeps(deps)
  return deletePartV2(partId, resolved)
}

/**
 * Server helper to insert a new observation record.
 */
export async function recordObservation(input: CreateObservationInput, deps: PrdServerDeps): Promise<ObservationRow> {
  const startTime = Date.now()
  const resolved = await resolveDeps(deps)
  logOperation('recordObservation', { type: input.type, content_length: input.content?.length, userId: deps.userId })
  try {
    const result = await createObservation(input, resolved)
    const duration = Date.now() - startTime
    console.log(`[prd-schema] recordObservation completed in ${duration}ms: ${result.id}`)
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[prd-schema] recordObservation failed in ${duration}ms:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}

/**
 * Server helper to list recent observations with optional filters.
 */
export async function recentObservations(input: ListObservationsInput, deps: PrdServerDeps): Promise<ObservationRow[]> {
  const resolved = await resolveDeps(deps)
  return listObservations(input, resolved)
}

/**
 * Server helper to update observation follow-up metadata.
 */
export async function updateObservation(
  observationId: string,
  updates: { completed?: boolean; metadata?: Record<string, any> },
  deps: PrdServerDeps
): Promise<ObservationRow> {
  const resolved = await resolveDeps(deps)
  return updateObservationFollowUp(observationId, updates, resolved)
}

/**
 * Server helper to create a session record.
 */
export async function createSessionRecord(input: CreateSessionInput, deps: PrdServerDeps): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps)
  return createSession(input, resolved)
}

/**
 * Server helper to append session activity metadata.
 */
export async function touchSession(
  sessionId: string,
  updates: { last_message_at?: string; observations?: string[] },
  deps: PrdServerDeps
): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps)
  return appendSessionActivity(sessionId, updates, resolved)
}

/**
 * Server helper to mark a session as completed.
 */
export async function completeSessionRecord(
  sessionId: string,
  input: CompleteSessionInput,
  deps: PrdServerDeps
): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps)
  return completeSession(sessionId, input, resolved)
}

/**
 * Server helper to fetch the current active session.
 */
export async function getActiveSessionRecord(deps: PrdServerDeps): Promise<SessionRowV2 | null> {
  const resolved = await resolveDeps(deps)
  return getActiveSession(resolved)
}

/**
 * Server helper to fetch a specific session by ID.
 */
export async function getSessionRecord(sessionId: string, deps: PrdServerDeps): Promise<SessionRowV2 | null> {
  const resolved = await resolveDeps(deps)
  const { getSession } = await import('./index')
  return getSession(sessionId, resolved)
}

/**
 * Server helper to list recent sessions for the user.
 */
export async function listSessionRecords(deps: PrdServerDeps, limit?: number): Promise<SessionRowV2[]> {
  const resolved = await resolveDeps(deps)
  const { listSessions } = await import('./index')
  return listSessions(resolved, limit ?? 10)
}

/**
 * Server helper to upsert a part relationship.
 */
export async function upsertRelationshipRecord(
  input: UpsertRelationshipInput,
  deps: PrdServerDeps
): Promise<PartRelationshipRowV2> {
  const resolved = await resolveDeps(deps)
  return upsertRelationship(input, resolved)
}

/**
 * Server helper to list relationships with optional filters.
 */
export async function listRelationshipRecords(
  deps: PrdServerDeps,
  filters?: { partId?: string; type?: UpsertRelationshipInput['type'] }
): Promise<PartRelationshipRowV2[]> {
  const resolved = await resolveDeps(deps)
  return listRelationships(resolved, filters)
}

/**
 * Server helper to create a timeline event.
 */
export async function createTimelineEventRecord(
  input: CreateTimelineEventInput,
  deps: PrdServerDeps
): Promise<TimelineEventRow> {
  const resolved = await resolveDeps(deps)
  return createTimelineEvent(input, resolved)
}

/**
 * Server helper to list timeline events for a user.
 */
export async function listTimelineEventRecords(deps: PrdServerDeps, limit?: number): Promise<TimelineEventRow[]> {
  const resolved = await resolveDeps(deps)
  return listTimelineEvents(resolved, limit)
}

/**
 * Server helper to list part display rows from the computed view.
 * @param deps - Server dependencies (userId + client)
 * @param limit - Number to apply a limit (default: 50), or null to fetch all parts unbounded
 */
export async function listPartDisplayRecords(
  deps: PrdServerDeps,
  limit: number | null = 50
): Promise<PartDisplayRow[]> {
  const resolved = await resolveDeps(deps)
  return listPartsDisplay(resolved, limit)
}

/**
 * Server helper to fetch a single part display row.
 */
export async function getPartDisplayRecord(
  partId: string,
  deps: PrdServerDeps
): Promise<PartDisplayRow | null> {
  const resolved = await resolveDeps(deps)
  return getPartDisplay(partId, resolved)
}

/**
 * Server helper to list timeline display entries.
 */
export async function listTimelineDisplayRecords(
  deps: PrdServerDeps,
  limit?: number
): Promise<TimelineDisplayRow[]> {
  const resolved = await resolveDeps(deps)
  return listTimelineDisplay(resolved, limit ?? 100)
}

/**
 * Server helper to load the cached user context snapshot.
 */
export async function loadUserContextCache(
  deps: PrdServerDeps
): Promise<UserContextCacheRow | null> {
  const startTime = Date.now()
  const resolved = await resolveDeps(deps)
  logOperation('loadUserContextCache', { userId: deps.userId })
  try {
    const result = await getUserContextCache(resolved)
    const duration = Date.now() - startTime
    console.log(`[prd-schema] loadUserContextCache completed in ${duration}ms, cache ${result ? 'found' : 'not found'}`)
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[prd-schema] loadUserContextCache failed in ${duration}ms:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}

/**
 * Server helper to trigger a context cache refresh using the service role client.
 */
export async function refreshContextCache(client?: SupabaseDatabaseClient): Promise<void> {
  const startTime = Date.now()
  logOperation('refreshContextCache', {})
  try {
    const supabase = client ?? (await getServerSupabaseClient())
    await refreshUserContextCache(supabase)
    const duration = Date.now() - startTime
    console.log(`[prd-schema] refreshContextCache completed in ${duration}ms`)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[prd-schema] refreshContextCache failed in ${duration}ms:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}
