import 'server-only';
import logger from '@/lib/logger';

import { getServerSupabaseClient } from '@/lib/supabase/clients';
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients';
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
  searchPartsServer as searchPartsV2,
  getPartByIdServer as getPartByIdV2,
  upsertPartServer as upsertPartV2,
  deletePartServer as deletePartV2,
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
} from './index';

export type PrdServerDeps = {
  userId: string;
  client?: SupabaseDatabaseClient;
};

/**
 * Resolve Supabase dependencies for server-side data access, injecting defaults when omitted.
 */
async function resolveDeps(
  deps: PrdServerDeps
): Promise<{ client: SupabaseDatabaseClient; userId: string }> {
  if (!deps?.userId) {
    throw new Error('userId is required for PRD data operations');
  }
  const client = deps.client ?? (await getServerSupabaseClient());
  return { client, userId: deps.userId };
}

/**
 * Log schema operation for observability and debugging.
 * Logs operations with timestamp, operation name, and optional parameters to help track
 * PRD data access patterns and debug issues in the field.
 *
 * @param operation - The name of the operation being logged (e.g., 'searchParts', 'recordObservation')
 * @param params - Optional structured parameters to include in the log entry
 */
function logOperation(operation: string, params?: Record<string, any>) {
  logger.info({ operation, params }, `[prd-schema] ${operation}`);
}

/**
 * Search parts with optional filters, category, status, and full-text query support.
 * Logs operation timing and result count for observability. Errors include operation duration
 * and actionable context.
 *
 * @param input - Search criteria including optional query, category, status, and result limit
 * @param deps - Dependencies containing userId and optional Supabase client
 * @returns Array of matching part records
 */
export async function searchParts(
  input: SearchPartsInput,
  deps: PrdServerDeps
): Promise<PartRowV2[]> {
  const startTime = Date.now();
  const resolved = await resolveDeps(deps);
  logOperation('searchParts', { query: input.query, limit: input.limit, userId: deps.userId });
  try {
    const result = await searchPartsV2(input, resolved);
    const duration = Date.now() - startTime;
    logger.info({ duration, count: result.length }, `[prd-schema] searchParts completed`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ duration, error }, `[prd-schema] searchParts failed`);
    throw error;
  }
}

/**
 * Server helper to fetch a single part by ID.
 */
export async function getPart(partId: string, deps: PrdServerDeps): Promise<PartRowV2 | null> {
  const resolved = await resolveDeps(deps);
  return getPartByIdV2({ partId }, resolved);
}

/**
 * Create or update a part record with optional ID, name, category, status, and metadata.
 * Logs operation timing and part details for observability. Returns the resulting part record.
 * Errors include operation duration and context for debugging.
 *
 * @param input - Part data including optional ID (for updates), name, category, status
 * @param deps - Dependencies containing userId and optional Supabase client
 * @returns The created or updated part record
 */
export async function upsertPart(input: UpsertPartInput, deps: PrdServerDeps): Promise<PartRowV2> {
  const startTime = Date.now();
  const resolved = await resolveDeps(deps);
  logOperation('upsertPart', {
    id: input.id,
    name: input.name,
    category: input.category,
    userId: deps.userId,
  });
  try {
    const result = await upsertPartV2(input, resolved);
    const duration = Date.now() - startTime;
    logger.info({ duration, id: result.id }, `[prd-schema] upsertPart completed`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ duration, error }, `[prd-schema] upsertPart failed`);
    throw error;
  }
}

/**
 * Server helper to delete a part record.
 */
export async function removePart(partId: string, deps: PrdServerDeps): Promise<void> {
  const resolved = await resolveDeps(deps);
  return deletePartV2(partId, resolved);
}

/**
 * Record a new observation (e.g., client insight, part behavior, therapeutic note).
 * Logs operation timing and observation type for observability. Returns the recorded observation.
 * Errors include operation duration and actionable context for triage.
 *
 * @param input - Observation data including content, type (note/behavior/etc.), and optional entities
 * @param deps - Dependencies containing userId and optional Supabase client
 * @returns The created observation record with ID and timestamp
 */
export async function recordObservation(
  input: CreateObservationInput,
  deps: PrdServerDeps
): Promise<ObservationRow> {
  const startTime = Date.now();
  const resolved = await resolveDeps(deps);
  logOperation('recordObservation', {
    type: input.type,
    content_length: input.content?.length,
    userId: deps.userId,
  });
  try {
    const result = await createObservation(input, resolved);
    const duration = Date.now() - startTime;
    logger.info({ duration, id: result.id }, `[prd-schema] recordObservation completed`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ duration, error }, `[prd-schema] recordObservation failed`);
    throw error;
  }
}

/**
 * Server helper to list recent observations with optional filters.
 */
export async function recentObservations(
  input: ListObservationsInput,
  deps: PrdServerDeps
): Promise<ObservationRow[]> {
  const resolved = await resolveDeps(deps);
  return listObservations(input, resolved);
}

/**
 * Server helper to update observation follow-up metadata.
 */
export async function updateObservation(
  observationId: string,
  updates: { completed?: boolean; metadata?: Record<string, any> },
  deps: PrdServerDeps
): Promise<ObservationRow> {
  const resolved = await resolveDeps(deps);
  return updateObservationFollowUp(observationId, updates, resolved);
}

/**
 * Server helper to create a session record.
 */
export async function createSessionRecord(
  input: CreateSessionInput,
  deps: PrdServerDeps
): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps);
  return createSession(input, resolved);
}

/**
 * Server helper to append session activity metadata.
 */
export async function touchSession(
  sessionId: string,
  updates: { last_message_at?: string; observations?: string[] },
  deps: PrdServerDeps
): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps);
  return appendSessionActivity(sessionId, updates, resolved);
}

/**
 * Server helper to mark a session as completed.
 */
export async function completeSessionRecord(
  sessionId: string,
  input: CompleteSessionInput,
  deps: PrdServerDeps
): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps);
  return completeSession(sessionId, input, resolved);
}

/**
 * Server helper to fetch the current active session.
 */
export async function getActiveSessionRecord(deps: PrdServerDeps): Promise<SessionRowV2 | null> {
  const resolved = await resolveDeps(deps);
  return getActiveSession(resolved);
}

/**
 * Server helper to fetch a specific session by ID.
 */
export async function getSessionRecord(
  sessionId: string,
  deps: PrdServerDeps
): Promise<SessionRowV2 | null> {
  const resolved = await resolveDeps(deps);
  const { getSession } = await import('./index');
  return getSession(sessionId, resolved);
}

/**
 * Server helper to list recent sessions for the user.
 */
export async function listSessionRecords(
  deps: PrdServerDeps,
  limit?: number
): Promise<SessionRowV2[]> {
  const resolved = await resolveDeps(deps);
  const { listSessions } = await import('./index');
  return listSessions(resolved, limit ?? 10);
}

/**
 * Server helper to upsert a part relationship.
 */
export async function upsertRelationshipRecord(
  input: UpsertRelationshipInput,
  deps: PrdServerDeps
): Promise<PartRelationshipRowV2> {
  const resolved = await resolveDeps(deps);
  return upsertRelationship(input, resolved);
}

/**
 * Server helper to list relationships with optional filters.
 */
export async function listRelationshipRecords(
  deps: PrdServerDeps,
  filters?: { partId?: string; type?: UpsertRelationshipInput['type'] }
): Promise<PartRelationshipRowV2[]> {
  const resolved = await resolveDeps(deps);
  return listRelationships(resolved, filters);
}

/**
 * Server helper to create a timeline event.
 */
export async function createTimelineEventRecord(
  input: CreateTimelineEventInput,
  deps: PrdServerDeps
): Promise<TimelineEventRow> {
  const resolved = await resolveDeps(deps);
  return createTimelineEvent(input, resolved);
}

/**
 * Server helper to list timeline events for a user.
 */
export async function listTimelineEventRecords(
  deps: PrdServerDeps,
  limit?: number
): Promise<TimelineEventRow[]> {
  const resolved = await resolveDeps(deps);
  return listTimelineEvents(resolved, limit);
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
  const resolved = await resolveDeps(deps);
  return listPartsDisplay(resolved, limit);
}

/**
 * Server helper to fetch a single part display row.
 */
export async function getPartDisplayRecord(
  partId: string,
  deps: PrdServerDeps
): Promise<PartDisplayRow | null> {
  const resolved = await resolveDeps(deps);
  return getPartDisplay(partId, resolved);
}

/**
 * Server helper to list timeline display entries.
 */
export async function listTimelineDisplayRecords(
  deps: PrdServerDeps,
  limit?: number
): Promise<TimelineDisplayRow[]> {
  const resolved = await resolveDeps(deps);
  return listTimelineDisplay(resolved, limit ?? 100);
}

/**
 * Load the cached user context snapshot for pre-computed session data.
 * Includes recent parts, topics, open threads, and follow-ups for quick access during sessions.
 * Logs operation timing and cache availability for observability. Returns null if cache not yet built.
 *
 * @param deps - Dependencies containing userId and optional Supabase client
 * @returns The cached context row if available, null if not yet built
 */
export async function loadUserContextCache(
  deps: PrdServerDeps
): Promise<UserContextCacheRow | null> {
  const startTime = Date.now();
  const resolved = await resolveDeps(deps);
  logOperation('loadUserContextCache', { userId: deps.userId });
  try {
    const result = await getUserContextCache(resolved);
    const duration = Date.now() - startTime;
    logger.info({ duration, found: !!result }, `[prd-schema] loadUserContextCache completed`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ duration, error }, `[prd-schema] loadUserContextCache failed`);
    throw error;
  }
}

/**
 * Refresh the user context cache across all users using service-role privileges.
 * Pre-computes recent parts, active topics, follow-ups, and related context for fast session loading.
 * Logs operation timing and completion status for observability. Errors include operation duration
 * and diagnostic context for troubleshooting cache issues.
 *
 * @param client - Optional pre-configured Supabase client; defaults to server client if omitted
 */
export async function refreshContextCache(client?: SupabaseDatabaseClient): Promise<void> {
  const startTime = Date.now();
  logOperation('refreshContextCache', {});
  try {
    const supabase = client ?? (await getServerSupabaseClient());
    await refreshUserContextCache(supabase);
    const duration = Date.now() - startTime;
    logger.info({ duration }, `[prd-schema] refreshContextCache completed`);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ duration, error }, `[prd-schema] refreshContextCache failed`);
    throw error;
  }
}
