import { z } from 'zod'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import { partCategoryEnum, partStatusEnum, partChargeEnum } from './types'

export const partDisplayRowSchema = z
  .object({
    user_id: z.string().uuid(),
    id: z.string().uuid(),
    display_name: z.string(),
    name: z.string().nullable(),
    placeholder: z.string().nullable(),
    category: partCategoryEnum,
    status: partStatusEnum,
    charge: partChargeEnum,
    emoji: z.string().nullable(),
    age: z.string().nullable(),
    role: z.string().nullable(),
    confidence: z.number(),
    evidence_count: z.number().int().nonnegative(),
    needs_attention: z.boolean(),
    last_active: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    observation_count: z.number().int().nonnegative(),
    last_observed_at: z.string().datetime().nullable(),
    relationship_count: z.number().int().nonnegative(),
    last_relationship_at: z.string().datetime().nullable(),
  })
  .strict()

export type PartDisplayRow = z.infer<typeof partDisplayRowSchema>

export async function listPartsDisplay(
  deps: PrdDataDependencies,
  limit = 50
): Promise<PartDisplayRow[]> {
  const { client, userId } = assertPrdDeps(deps)
  const { data, error } = await client
    .from('parts_display')
    .select('*')
    .eq('user_id', userId)
    .order('last_active', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load parts_display: ${error.message}`)
  }

  return (data ?? []).map((row) => partDisplayRowSchema.parse(row))
}

export async function getPartDisplay(
  partId: string,
  deps: PrdDataDependencies
): Promise<PartDisplayRow | null> {
  const { client, userId } = assertPrdDeps(deps)
  const { data, error } = await client
    .from('parts_display')
    .select('*')
    .eq('user_id', userId)
    .eq('id', partId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch parts_display row: ${error.message}`)
  }

  if (!data) return null
  return partDisplayRowSchema.parse(data)
}

export const timelineDisplayRowSchema = z
  .object({
    user_id: z.string().uuid(),
    created_at: z.string().datetime(),
    event_type: z.enum(['observation', 'part', 'relationship', 'timeline_event']),
    event_subtype: z.string(),
    description: z.string(),
    entities: z.array(z.string().uuid()),
    metadata: z.record(z.any()),
    source_id: z.string().uuid(),
    source_table: z.enum(['observations', 'parts_v2', 'part_relationships_v2', 'timeline_events']),
    session_id: z.string().uuid().nullable(),
  })
  .strict()

export type TimelineDisplayRow = z.infer<typeof timelineDisplayRowSchema>

export async function listTimelineDisplay(
  deps: PrdDataDependencies,
  limit = 100
): Promise<TimelineDisplayRow[]> {
  const { client, userId } = assertPrdDeps(deps)
  const { data, error } = await client
    .from('timeline_display')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load timeline_display: ${error.message}`)
  }

  return (data ?? []).map((row) => timelineDisplayRowSchema.parse(row))
}

export const userContextCacheRowSchema = z
  .object({
    user_id: z.string().uuid(),
    recent_parts: z.array(z.record(z.any())),
    incomplete_parts: z.array(z.record(z.any())),
    follow_ups: z.array(z.record(z.any())),
    recent_events: z.array(z.record(z.any())),
    last_session: z.record(z.any()).nullable(),
    cache_time: z.string().datetime(),
    last_observation_at: z.string().datetime().nullable(),
    total_sessions: z.number().int().nonnegative(),
    total_parts: z.number().int().nonnegative(),
    attention_count: z.number().int().nonnegative(),
  })
  .strict()

export type UserContextCacheRow = z.infer<typeof userContextCacheRowSchema>

export async function getUserContextCache(
  deps: PrdDataDependencies
): Promise<UserContextCacheRow | null> {
  const { client, userId } = assertPrdDeps(deps)
  const { data, error } = await client
    .from('user_context_cache')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load user_context_cache: ${error.message}`)
  }

  if (!data) return null
  return userContextCacheRowSchema.parse(data)
}

export async function refreshUserContextCache(client: SupabaseDatabaseClient): Promise<void> {
  const { error } = await client.rpc('refresh_user_context_cache')
  if (error) {
    throw new Error(`Failed to refresh user_context_cache: ${error.message}`)
  }
}
