import { z } from 'zod'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import {
  partCategoryEnum,
  partStatusEnum,
  partChargeEnum,
  observationTypeEnum,
  sessionTypeEnum,
} from './types'

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
  limit?: number
): Promise<PartDisplayRow[]> {
  const { client, userId } = assertPrdDeps(deps)
  let query = client
    .from('parts_display')
    .select('*')
    .eq('user_id', userId)
    .order('last_active', { ascending: false, nullsFirst: false })

  if (typeof limit === 'number') {
    query = query.limit(limit)
  }

  const { data, error } = await query

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

const observationMetadataSchema = z.record(z.any())

const partMetadataSchema = z.record(z.any())

const relationshipMetadataSchema = z
  .object({
    strength: z.number().nullable().optional(),
    context: z.string().nullable().optional(),
    observations: z.array(z.string()).optional(),
  })
  .passthrough()

const timelineEventMetadataSchema = z.record(z.any())

export const timelineDisplayRowSchema = z
  .object({
    user_id: z.string().uuid(),
    created_at: z.string().datetime(),
    event_type: z.enum(['observation', 'part', 'relationship', 'timeline_event']),
    event_subtype: z.string(),
    description: z.string(),
    entities: z.array(z.string().uuid()),
    metadata: z.union([
      observationMetadataSchema,
      partMetadataSchema,
      relationshipMetadataSchema,
      timelineEventMetadataSchema,
    ]),
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

const recentPartSchema = z
  .object({
    id: z.string().uuid(),
    display_name: z.string(),
    category: partCategoryEnum,
    status: partStatusEnum,
    charge: partChargeEnum,
    needs_attention: z.boolean(),
    last_active: z.string().datetime().nullable(),
    emoji: z.string().nullable(),
  })
  .strict()

const incompletePartSchema = z
  .object({
    id: z.string().uuid(),
    display_name: z.string(),
    next_step: z.enum(['needs_name', 'needs_role', 'needs_category', 'needs_details']),
    updated_at: z.string().datetime().nullable(),
  })
  .strict()

const followUpSchema = z
  .object({
    id: z.string().uuid(),
    content: z.string(),
    type: observationTypeEnum,
    created_at: z.string().datetime(),
  })
  .strict()

const timelineDisplayEventSchema = timelineDisplayRowSchema

const lastSessionSchema = z
  .object({
    id: z.string().uuid(),
    type: sessionTypeEnum,
    summary: z.string().nullable(),
    key_insights: z.array(z.string()),
    homework: z.array(z.string()),
    next_session: z.array(z.string()),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime().nullable(),
  })
  .strict()

export const userContextCacheRowSchema = z
  .object({
    user_id: z.string().uuid(),
    recent_parts: z.array(recentPartSchema),
    incomplete_parts: z.array(incompletePartSchema),
    follow_ups: z.array(followUpSchema),
    recent_events: z.array(timelineDisplayEventSchema),
    last_session: lastSessionSchema.nullable(),
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
