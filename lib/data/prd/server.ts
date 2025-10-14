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
  type PartRowV2,
  type ObservationRow,
  type SessionRowV2,
  type PartRelationshipRowV2,
  type TimelineEventRow,
} from './index'

type PrdServerDeps = {
  userId: string
  client?: SupabaseDatabaseClient
}

async function resolveDeps(deps: PrdServerDeps) {
  if (!deps?.userId) {
    throw new Error('userId is required for PRD data operations')
  }
  const client = deps.client ?? (await getServerSupabaseClient())
  return { client, userId: deps.userId }
}

export async function searchParts(input: SearchPartsInput, deps: PrdServerDeps): Promise<PartRowV2[]> {
  const resolved = await resolveDeps(deps)
  return searchPartsV2(input, resolved)
}

export async function getPart(partId: string, deps: PrdServerDeps): Promise<PartRowV2 | null> {
  const resolved = await resolveDeps(deps)
  return getPartByIdV2(partId, resolved)
}

export async function upsertPart(input: UpsertPartInput, deps: PrdServerDeps): Promise<PartRowV2> {
  const resolved = await resolveDeps(deps)
  return upsertPartV2(input, resolved)
}

export async function removePart(partId: string, deps: PrdServerDeps): Promise<void> {
  const resolved = await resolveDeps(deps)
  return deletePartV2(partId, resolved)
}

export async function recordObservation(input: CreateObservationInput, deps: PrdServerDeps): Promise<ObservationRow> {
  const resolved = await resolveDeps(deps)
  return createObservation(input, resolved)
}

export async function recentObservations(input: ListObservationsInput, deps: PrdServerDeps): Promise<ObservationRow[]> {
  const resolved = await resolveDeps(deps)
  return listObservations(input, resolved)
}

export async function updateObservation(
  observationId: string,
  updates: { completed?: boolean; metadata?: Record<string, any> },
  deps: PrdServerDeps
): Promise<ObservationRow> {
  const resolved = await resolveDeps(deps)
  return updateObservationFollowUp(observationId, updates, resolved)
}

export async function createSessionRecord(input: CreateSessionInput, deps: PrdServerDeps): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps)
  return createSession(input, resolved)
}

export async function touchSession(
  sessionId: string,
  updates: { last_message_at?: string; observations?: string[] },
  deps: PrdServerDeps
): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps)
  return appendSessionActivity(sessionId, updates, resolved)
}

export async function completeSessionRecord(
  sessionId: string,
  input: CompleteSessionInput,
  deps: PrdServerDeps
): Promise<SessionRowV2> {
  const resolved = await resolveDeps(deps)
  return completeSession(sessionId, input, resolved)
}

export async function getActiveSessionRecord(deps: PrdServerDeps): Promise<SessionRowV2 | null> {
  const resolved = await resolveDeps(deps)
  return getActiveSession(resolved)
}

export async function upsertRelationshipRecord(
  input: UpsertRelationshipInput,
  deps: PrdServerDeps
): Promise<PartRelationshipRowV2> {
  const resolved = await resolveDeps(deps)
  return upsertRelationship(input, resolved)
}

export async function listRelationshipRecords(
  deps: PrdServerDeps,
  filters?: { partId?: string; type?: UpsertRelationshipInput['type'] }
): Promise<PartRelationshipRowV2[]> {
  const resolved = await resolveDeps(deps)
  return listRelationships(resolved, filters)
}

export async function createTimelineEventRecord(
  input: CreateTimelineEventInput,
  deps: PrdServerDeps
): Promise<TimelineEventRow> {
  const resolved = await resolveDeps(deps)
  return createTimelineEvent(input, resolved)
}

export async function listTimelineEventRecords(deps: PrdServerDeps, limit?: number): Promise<TimelineEventRow[]> {
  const resolved = await resolveDeps(deps)
  return listTimelineEvents(resolved, limit)
}
