import type { Database } from '@/lib/types/database'
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

// Replace direct `parts`/`part_relationships` table access with PRD-backed views
// Usage scoped to client contexts only.

type PartsLiteDependencies = {
  client?: SupabaseDatabaseClient
}

// Internal types for Views
interface PartsDisplayRow {
  user_id: string
  id: string
  display_name: string
  name: string | null
  placeholder: string | null
  category: string
  status: string
  charge: string | null
  emoji: string | null
  age: string | null // View returns text from JSON
  role: string | null
  confidence: number | null
  evidence_count: number | null
  needs_attention: boolean | null
  last_active: string | null
  created_at: string
}

interface TimelineDisplayRow {
  user_id: string
  created_at: string
  event_type: string
  event_subtype: string
  description: string | null
  entities: string[]
  metadata: Record<string, any>
  source_id: string
  source_table: string
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

function mapPartsDisplayRowToV2(row: PartsDisplayRow): PartRowV2 {
  const age = row.age ? Number(row.age) : undefined
  const data: Record<string, any> = {
    emoji: row.emoji,
    role: row.role,
    age: Number.isNaN(age!) ? undefined : age,
    visualization: {
      emoji: row.emoji ?? '🤗',
    }
  }

  return partRowSchema.parse({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    placeholder: row.placeholder,
    category: row.category,
    status: row.status,
    charge: row.charge,
    data,
    needs_attention: row.needs_attention ?? false,
    confidence: row.confidence ?? 0,
    evidence_count: row.evidence_count ?? 0,
    first_noticed: row.created_at,
    last_active: row.last_active,
    created_at: row.created_at,
    updated_at: row.last_active ?? row.created_at,
  })
}

function mapTimelineRowToRelationship(row: TimelineDisplayRow): PartRelationshipRowV2 {
  const metadata = row.metadata || {}
  const entities = row.entities || []
  
  // Cast event_subtype to relationship type directly as they share the same enum values in V2
  const type = row.event_subtype as any 

  return {
    id: row.source_id,
    user_id: row.user_id,
    part_a_id: entities[0], // part_a is first element in array
    part_b_id: entities[1], // part_b is second element
    type, 
    strength: metadata.strength ?? 0.5,
    context: metadata.context,
    observations: metadata.observations || [],
    created_at: row.created_at,
    updated_at: row.created_at, // timeline_display lacks updated_at, using created_at
  }
}

export async function searchParts(input: SearchPartsInput, deps: PartsLiteDependencies = {}): Promise<SearchPartsResult> {
  return runWithClient(searchPartsSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase)

    let query = supabase
      .from('parts_display' as any)
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false, nullsFirst: false })

    if (validated.query) {
      const pattern = `%${validated.query.replace(/([%_])/g, '\\$1')}%`
      // parts_display has role column extracted from data
      query = query.or(`name.ilike.${pattern},placeholder.ilike.${pattern},role.ilike.${pattern}`)
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

    const rows = Array.isArray(data) ? (data as PartsDisplayRow[]) : []
    // mapPartsDisplayRowToV2 returns PartRowV2, mapPartRowFromV2 converts PartRowV2 to PartRow
    return rows.map((row) => mapPartRowFromV2(mapPartsDisplayRowToV2(row)))
  })
}

export async function searchPartsV2(input: SearchPartsInput, deps: PartsLiteDependencies = {}): Promise<PartRowV2[]> {
  return runWithClient(searchPartsSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase)

    let query = supabase
      .from('parts_display' as any)
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false, nullsFirst: false })

    if (validated.query) {
      const pattern = `%${validated.query.replace(/([%_])/g, '\\$1')}%`
      query = query.or(`name.ilike.${pattern},placeholder.ilike.${pattern},role.ilike.${pattern}`)
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

    const rows = Array.isArray(data) ? (data as PartsDisplayRow[]) : []
    return rows.map((row) => {
      try {
        return mapPartsDisplayRowToV2(row)
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
      .from('parts_display' as any)
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

    return mapPartRowFromV2(mapPartsDisplayRowToV2(data as PartsDisplayRow))
  })
}

export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsLiteDependencies = {}
): Promise<GetPartRelationshipsResult> {
  return runWithClient(getPartRelationshipsSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase)

    let query = supabase
      .from('timeline_display' as any)
      .select('*')
      .eq('user_id', userId)
      .eq('source_table', 'part_relationships_v2')
      .order('created_at', { ascending: false }) // timeline_display sorts by created_at

    if (validated.relationshipType) {
      // event_subtype contains the V2 relationship type
      query = query.eq('event_subtype', toV2RelationshipType(validated.relationshipType))
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const rows = Array.isArray(data) ? (data as TimelineDisplayRow[]) : []
    
    // Map to V2 rows
    const relRows = rows.map(mapTimelineRowToRelationship)

    const enriched = relRows.map((rel) => ({
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
          .from('parts_display' as any)
          .select('id, name, status') // parts_display has name and status
          .eq('user_id', userId)
          .in('id', Array.from(partIds))

        if (partsError) {
          throw new Error(`Failed to fetch part details: ${partsError.message}`)
        }

        partsDetails = (parts ?? []).reduce<Record<string, { name: string; status: string }>>((acc, part: any) => {
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
