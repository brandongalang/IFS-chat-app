import 'server-only'

import { getServerSupabaseClient } from '@/lib/supabase/clients'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import {
  searchParts as searchPartsData,
  getPartById as getPartByIdData,
  getPartDetail as getPartDetailData,
  createEmergingPart as createEmergingPartData,
  updatePart as updatePartData,
  getPartRelationships as getPartRelationshipsData,
  getPartNotes as getPartNotesData,
  logRelationship as logRelationshipData,
} from './parts'
import type {
  SearchPartsInput,
  SearchPartsResult,
  GetPartByIdInput,
  GetPartByIdResult,
  GetPartDetailInput,
  GetPartDetailResult,
  CreateEmergingPartInput,
  CreateEmergingPartResult,
  UpdatePartInput,
  UpdatePartResult,
  GetPartRelationshipsInput,
  GetPartRelationshipsResult,
  GetPartNotesInput,
  GetPartNotesResult,
  LogRelationshipInput,
  LogRelationshipResult,
} from './parts.schema'

export type PartsServerDependencies = {
  userId: string
  client?: SupabaseDatabaseClient
}

async function resolveDependencies(deps: PartsServerDependencies): Promise<{ client: SupabaseDatabaseClient; userId: string }> {
  if (!deps?.userId) {
    throw new Error('userId is required for parts data operations')
  }

  const client = deps.client ?? (await getServerSupabaseClient())
  return { client, userId: deps.userId }
}

export async function searchParts(input: SearchPartsInput, deps: PartsServerDependencies): Promise<SearchPartsResult> {
  const resolved = await resolveDependencies(deps)
  return searchPartsData(input, resolved)
}

export async function getPartById(input: GetPartByIdInput, deps: PartsServerDependencies): Promise<GetPartByIdResult> {
  const resolved = await resolveDependencies(deps)
  return getPartByIdData(input, resolved)
}

export async function getPartDetail(input: GetPartDetailInput, deps: PartsServerDependencies): Promise<GetPartDetailResult> {
  const resolved = await resolveDependencies(deps)
  return getPartDetailData(input, resolved)
}

export async function createEmergingPart(input: CreateEmergingPartInput, deps: PartsServerDependencies): Promise<CreateEmergingPartResult> {
  const resolved = await resolveDependencies(deps)
  return createEmergingPartData(input, resolved)
}

export async function updatePart(input: UpdatePartInput, deps: PartsServerDependencies): Promise<UpdatePartResult> {
  const resolved = await resolveDependencies(deps)
  return updatePartData(input, resolved)
}

export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsServerDependencies
): Promise<GetPartRelationshipsResult> {
  const resolved = await resolveDependencies(deps)
  return getPartRelationshipsData(input, resolved)
}

export async function getPartNotes(input: GetPartNotesInput, deps: PartsServerDependencies): Promise<GetPartNotesResult> {
  const resolved = await resolveDependencies(deps)
  return getPartNotesData(input, resolved)
}

export async function logRelationship(input: LogRelationshipInput, deps: PartsServerDependencies): Promise<LogRelationshipResult> {
  const resolved = await resolveDependencies(deps)
  return logRelationshipData(input, resolved)
}
