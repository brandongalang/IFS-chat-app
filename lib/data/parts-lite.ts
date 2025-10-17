import type { PartRow, Database } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  searchPartsSchema,
  getPartByIdSchema,
  getPartRelationshipsSchema,
  type SearchPartsInput,
  type SearchPartsResult,
  type GetPartByIdInput,
  type GetPartByIdResult,
  type GetPartRelationshipsInput,
  type GetPartRelationshipsResult,
} from './parts.schema'
import {
  DEFAULT_RELATIONSHIP_STATUS,
  fromV2RelationshipType,
  mapPartRowFromV2,
  parseRelationshipContext,
  parseRelationshipObservations,
  toV2RelationshipType,
} from './schema/legacy-mappers'
import { normalizePartRowDates, partRowSchema, type PartRowV2, type PartRelationshipRowV2 } from './schema/types'

type SupabaseDatabaseClient = SupabaseClient<Database>

// TODO(ifs-chat-app-5): Replace direct `parts`/`part_relationships` table access with PRD-backed views
// once browser-safe endpoints are available. Keep usage scoped to client contexts only.

type PartsLiteDependencies = {
  client?: SupabaseDatabaseClient
}

function resolveClient(deps?: PartsLiteDependencies): SupabaseDatabaseClient {
  return deps?.client ?? createBrowserSupabaseClient()
}

async function runWithClient<TInput, TResult>(
  schema: { parse: (input: unknown) => TInput },
  input: TInput,
  deps: PartsLiteDependencies,
  handler: (validated: TInput, client: SupabaseDatabaseClient) => Promise<TResult>,
): Promise<TResult> {
  try {
    const validated = schema.parse(input)
    const supabase = resolveClient(deps)
    return await handler(validated, supabase)
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

async function requireUserId(client: SupabaseDatabaseClient): Promise<string> {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

export async function searchParts(input: SearchPartsInput, deps: PartsLiteDependencies = {}): Promise<SearchPartsResult> {
  return runWithClient(searchPartsSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase)

    let query = supabase
      .from('parts_v2')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false, nullsFirst: false })

    if (validated.query) {
      const pattern = `%${validated.query.replace(/([%_])/g, '\\$1')}%`
      query = query.or(`name.ilike.${pattern},placeholder.ilike.${pattern},data->>role.ilike.${pattern}`)
    }

    if (validated.category) {
      query = query.eq('category', validated.category)
    }

    if (validated.status) {
      query = query.eq('status', validated.status)
    }

    query = query.limit(validated.limit ?? 20)

    const { data, error } = await query
    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const rows = Array.isArray(data) ? (data as PartRowV2[]) : []
    return rows.map((row) => mapPartRowFromV2(partRowSchema.parse(normalizePartRowDates(row))))
  })
}

export async function searchPartsV2(input: SearchPartsInput, deps: PartsLiteDependencies = {}): Promise<PartRowV2[]> {
  return runWithClient(searchPartsSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase)

    let query = supabase
      .from('parts_v2')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false, nullsFirst: false })

    if (validated.query) {
      const pattern = `%${validated.query.replace(/([%_])/g, '\\$1')}%`
      query = query.or(`name.ilike.${pattern},placeholder.ilike.${pattern},data->>role.ilike.${pattern}`)
    }

    if (validated.category) {
      query = query.eq('category', validated.category)
    }

    if (validated.status) {
      query = query.eq('status', validated.status)
    }

    query = query.limit(validated.limit ?? 20)

    const { data, error } = await query
    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const rows = Array.isArray(data) ? data : []
    return rows.map((row) => {
      try {
        return partRowSchema.parse(normalizePartRowDates(row))
      } catch (err) {
        console.error('Failed to parse part row:', row, err)
        throw err
      }
    })
  })
}

export async function getPartById(input: GetPartByIdInput, deps: PartsLiteDependencies = {}): Promise<GetPartByIdResult> {
  return runWithClient(getPartByIdSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase)

    const { data, error } = await supabase
      .from('parts_v2')
      .select('*')
      .eq('id', validated.partId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error && (error as any).code !== 'PGRST116') {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!data) {
      return null
    }

    return mapPartRowFromV2(partRowSchema.parse(normalizePartRowDates(data as PartRowV2)))
  })
}

export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsLiteDependencies = {}
): Promise<GetPartRelationshipsResult> {
  return runWithClient(getPartRelationshipsSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase)

    let query = supabase
      .from('part_relationships_v2')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (validated.relationshipType) {
      query = query.eq('type', toV2RelationshipType(validated.relationshipType))
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const rows = Array.isArray(data) ? (data as PartRelationshipRowV2[]) : []

    const enriched = rows.map((rel) => ({
      rel,
      context: parseRelationshipContext(rel.context),
      dynamics: parseRelationshipObservations(rel.observations),
    }))

    let filtered = validated.partId
      ? enriched.filter(({ rel }) => rel.part_a_id === validated.partId || rel.part_b_id === validated.partId)
      : enriched

    if (validated.status) {
      filtered = filtered.filter(({ context }) => (context.status ?? DEFAULT_RELATIONSHIP_STATUS) === validated.status)
    }

    const limited = filtered.slice(0, validated.limit)

    let partsDetails: Record<string, { name: string; status: string }> = {}
    if (validated.includePartDetails) {
      const partIds = new Set<string>()
      for (const { rel } of limited) {
        partIds.add(rel.part_a_id)
        partIds.add(rel.part_b_id)
      }
      if (partIds.size > 0) {
        const { data: parts, error: partsError } = await supabase
          .from('parts_v2')
          .select('id, name, status')
          .eq('user_id', userId)
          .in('id', Array.from(partIds))

        if (partsError) {
          throw new Error(`Failed to fetch part details: ${partsError.message}`)
        }

        partsDetails = (parts ?? []).reduce<Record<string, { name: string; status: string }>>((acc, part) => {
          acc[part.id] = { name: part.name ?? 'Unnamed Part', status: part.status ?? 'active' }
          return acc
        }, {})
      }
    }

    return limited.map(({ rel, context, dynamics }) => {
      const polarization =
        typeof context.polarizationLevel === 'number'
          ? context.polarizationLevel
          : typeof rel.strength === 'number'
            ? Math.max(0, Math.min(1, 1 - rel.strength))
            : 0.5

      const partIds = [rel.part_a_id, rel.part_b_id]

      return {
        id: rel.id,
        type: fromV2RelationshipType(rel.type),
        status: context.status ?? DEFAULT_RELATIONSHIP_STATUS,
        description: context.description ?? null,
        issue: context.issue ?? null,
        common_ground: context.commonGround ?? null,
        polarization_level: polarization,
        dynamics,
        parts: partIds.map((partId) => ({
          id: partId,
          ...(validated.includePartDetails && partsDetails[partId]
            ? { name: partsDetails[partId].name, status: partsDetails[partId].status }
            : {}),
        })),
        last_addressed: context.lastAddressed ?? null,
        created_at: rel.created_at,
        updated_at: rel.updated_at,
      }
    })
  })
}
