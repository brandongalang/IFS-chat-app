import { z } from 'zod'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import {
  partRowSchema,
  partCategoryEnum,
  partStatusEnum,
  partChargeEnum,
  type PartRowV2,
} from './types'

const searchPartsInputSchema = z
  .object({
    query: z.string().optional(),
    category: partCategoryEnum.optional(),
    status: partStatusEnum.optional(),
    needsAttention: z.boolean().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict()

export type SearchPartsInput = z.infer<typeof searchPartsInputSchema>

const upsertPartInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().optional(),
    placeholder: z.string().optional(),
    category: partCategoryEnum.optional(),
    status: partStatusEnum.optional(),
    charge: partChargeEnum.optional(),
    data: z.record(z.any()).optional(),
    needs_attention: z.boolean().optional(),
    confidence: z.number().min(0).max(1).optional(),
    evidence_count: z.number().int().optional(),
    last_active: z.string().datetime().optional(),
    first_noticed: z.string().datetime().optional(),
  })
  .partial()

export type UpsertPartInput = z.infer<typeof upsertPartInputSchema>

/**
 * Search the parts_v2 table for the current user with flexible filters and fuzzy matching.
 */
export async function searchPartsV2(
  input: SearchPartsInput,
  deps: PrdDataDependencies
): Promise<PartRowV2[]> {
  const validated = searchPartsInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)

  let query = client
    .from('parts_v2')
    .select('*')
    .eq('user_id', userId)
    .order('last_active', { ascending: false, nullsFirst: false })

  if (validated.query) {
    const pattern = `%${validated.query.replace(/([%_])/g, '\\$1')}%`
    query = query.or(
      `name.ilike.${pattern},placeholder.ilike.${pattern},data->>role.ilike.${pattern}`
    )
  }
  if (validated.category) {
    query = query.eq('category', validated.category)
  }
  if (validated.status) {
    query = query.eq('status', validated.status)
  }
  if (typeof validated.needsAttention === 'boolean') {
    query = query.eq('needs_attention', validated.needsAttention)
  }

  query = query.limit(validated.limit)

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to search parts_v2: ${error.message}`)
  }

  const rows = Array.isArray(data) ? data : []
  return rows.map((row) => partRowSchema.parse(row))
}

/**
 * Retrieve a single part by ID for the current user, returning null when it does not exist.
 */
export async function getPartByIdV2(
  partId: string,
  deps: PrdDataDependencies
): Promise<PartRowV2 | null> {
  const { client, userId } = assertPrdDeps(deps)
  const { data, error } = await client
    .from('parts_v2')
    .select('*')
    .eq('id', partId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch part_v2: ${error.message}`)
  }

  if (!data) return null
  return partRowSchema.parse(data)
}

/**
 * Create or update a part in parts_v2, enforcing user scoping and returning the stored row.
 */
export async function upsertPartV2(
  input: UpsertPartInput,
  deps: PrdDataDependencies
): Promise<PartRowV2> {
  const payload = upsertPartInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)

  const insertOrUpdate = {
    ...payload,
    user_id: userId,
  }

  const { data, error } = await client
    .from('parts_v2')
    .upsert(insertOrUpdate, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to upsert part_v2: ${error.message}`)
  }

  return partRowSchema.parse(data)
}

/**
 * Delete a part scoped to the current user.
 */
export async function deletePartV2(partId: string, deps: PrdDataDependencies): Promise<void> {
  const { client, userId } = assertPrdDeps(deps)
  const { error } = await client
    .from('parts_v2')
    .delete()
    .eq('id', partId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete part_v2: ${error.message}`)
  }
}

export function withClient(client: SupabaseDatabaseClient, userId: string) {
  const deps = assertPrdDeps({ client, userId })
  return {
    search: (input: SearchPartsInput) => searchPartsV2(input, deps),
    get: (partId: string) => getPartByIdV2(partId, deps),
    upsert: (input: UpsertPartInput) => upsertPartV2(input, deps),
    remove: (partId: string) => deletePartV2(partId, deps),
  }
}
