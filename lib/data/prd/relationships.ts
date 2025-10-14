import { z } from 'zod'
import { assertPrdDeps, prdClient, type PrdDataDependencies } from './utils'
import {
  partRelationshipRowSchema,
  relationshipTypeEnum,
  type PartRelationshipRowV2,
} from './types'

const upsertRelationshipInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    part_a_id: z.string().uuid(),
    part_b_id: z.string().uuid(),
    type: relationshipTypeEnum,
    strength: z.number().min(0).max(1).optional(),
    context: z.string().nullable().optional(),
    observations: z.array(z.string()).optional(),
  })
  .strict()

export type UpsertRelationshipInput = z.infer<typeof upsertRelationshipInputSchema>

export async function upsertRelationship(
  input: UpsertRelationshipInput,
  deps: PrdDataDependencies
): Promise<PartRelationshipRowV2> {
  const payload = upsertRelationshipInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)
  const supabase = prdClient(client)

  const { data, error } = await supabase
    .from('part_relationships_v2')
    .upsert({
      ...payload,
      user_id: userId,
    }, { onConflict: 'part_a_id,part_b_id,type' })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to upsert relationship: ${error.message}`)
  }

  return partRelationshipRowSchema.parse(data)
}

export async function listRelationships(
  deps: PrdDataDependencies,
  filters?: { partId?: string; type?: z.infer<typeof relationshipTypeEnum> }
): Promise<PartRelationshipRowV2[]> {
  const { client, userId } = assertPrdDeps(deps)
  const supabase = prdClient(client)

  let query = supabase
    .from('part_relationships_v2')
    .select('*')
    .eq('user_id', userId)

  if (filters?.partId) {
    query = query.or(`part_a_id.eq.${filters.partId},part_b_id.eq.${filters.partId}`)
  }
  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  query = query.order('updated_at', { ascending: false })

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list relationships: ${error.message}`)
  }

  return (data ?? []).map((row) => partRelationshipRowSchema.parse(row))
}
