import type { PartRow, PartRelationshipRow, Database } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { buildPartsQuery, type PartQueryFilters } from './parts-query'
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

type SupabaseDatabaseClient = SupabaseClient<Database>

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
    const filters: PartQueryFilters = {
      name: validated.query,
      status: validated.status,
      category: validated.category,
      limit: validated.limit,
    }

    const userId = await requireUserId(supabase);

    const { data, error } = await buildPartsQuery(supabase, filters).eq('user_id', userId);
    if (error) throw new Error(`Database error: ${error.message}`)

    return (data || []) as SearchPartsResult
  })
}

export async function getPartById(input: GetPartByIdInput, deps: PartsLiteDependencies = {}): Promise<GetPartByIdResult> {
  return runWithClient(getPartByIdSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase);

    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('id', validated.partId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') {
        return null
      }
      throw new Error(`Database error: ${error.message}`)
    }

    return (data as PartRow | null) as GetPartByIdResult
  })
}

export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsLiteDependencies = {}
): Promise<GetPartRelationshipsResult> {
  return runWithClient(getPartRelationshipsSchema, input, deps, async (validated, supabase) => {
    const userId = await requireUserId(supabase);

    let query = supabase
      .from('part_relationships')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(validated.limit)

    if (validated.relationshipType) {
      query = query.eq('type', validated.relationshipType)
    }
    if (validated.status) {
      query = query.eq('status', validated.status)
    }

    const { data, error } = await query
    if (error) throw new Error(`Database error: ${error.message}`)

    const relationships = (data || []) as PartRelationshipRow[]

    let filtered = relationships

    if (validated.partId) {
      const pid = validated.partId
      filtered = relationships.filter((rel) => Array.isArray(rel.parts) && rel.parts.includes(pid))
    }

    let partsDetails: Record<string, { name: string; status: string }> = {}
    if (validated.includePartDetails) {
      const allPartIds = filtered.reduce((acc, rel) => {
        const partIds = Array.isArray(rel.parts) ? rel.parts : []
        return [...acc, ...partIds]
      }, [] as string[])
      const uniquePartIds = [...new Set(allPartIds)]
      if (uniquePartIds.length > 0) {
        const { data: parts, error: partsError } = await supabase
          .from('parts')
          .select('id, name, status')
          .eq('user_id', userId)  // Also filter parts by user_id
          .in('id', uniquePartIds)
        if (!partsError) {
          partsDetails = (parts || []).reduce((acc, part) => {
            acc[part.id] = { name: (part as any).name, status: (part as any).status }
            return acc
          }, {} as Record<string, { name: string; status: string }>)
        }
      }
    }

    return filtered.map((rel) => {
      const partIds = Array.isArray(rel.parts) ? rel.parts : []
      return {
        id: rel.id,
        type: rel.type,
        status: rel.status,
        description: rel.description,
        issue: rel.issue,
        common_ground: rel.common_ground,
        polarization_level: rel.polarization_level,
        dynamics: rel.dynamics || [],
        parts: partIds.map((partId: string) => ({
          id: partId,
          ...(validated.includePartDetails && partsDetails[partId]
            ? { name: partsDetails[partId].name, status: partsDetails[partId].status }
            : {}),
        })),
        last_addressed: rel.last_addressed,
        created_at: rel.created_at,
        updated_at: rel.updated_at,
      }
    }) as GetPartRelationshipsResult
  })
}
