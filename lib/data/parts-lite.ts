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

export async function searchParts(input: SearchPartsInput, deps: PartsLiteDependencies = {}): Promise<SearchPartsResult> {
  try {
    const validated = searchPartsSchema.parse(input)
    const supabase = resolveClient(deps)

    const filters: PartQueryFilters = {
      name: validated.query,
      status: validated.status,
      category: validated.category,
      limit: validated.limit,
    }

    const { data, error } = await buildPartsQuery(supabase, filters)
    if (error) throw new Error(`Database error: ${error.message}`)

    return (data || []) as SearchPartsResult
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

export async function getPartById(input: GetPartByIdInput, deps: PartsLiteDependencies = {}): Promise<GetPartByIdResult> {
  try {
    const validated = getPartByIdSchema.parse(input)
    const supabase = resolveClient(deps)

    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('id', validated.partId)
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') {
        return null
      }
      throw new Error(`Database error: ${error.message}`)
    }

    return (data as PartRow | null) as GetPartByIdResult
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsLiteDependencies = {}
): Promise<GetPartRelationshipsResult> {
  try {
    const validated = getPartRelationshipsSchema.parse(input)
    const supabase = resolveClient(deps)

    let query = supabase
      .from('part_relationships')
      .select('*')
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
      filtered = relationships.filter(rel => Array.isArray(rel.parts) && rel.parts.includes(pid))
    }

    // Optionally fetch basic part details
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
          .in('id', uniquePartIds)
        if (!partsError) {
          partsDetails = (parts || []).reduce((acc, part) => {
            acc[part.id] = { name: (part as any).name, status: (part as any).status }
            return acc
          }, {} as Record<string, { name: string; status: string }>)
        }
      }
    }

    const formatted: GetPartRelationshipsResult = filtered.map(rel => {
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
          ...(validated.includePartDetails && partsDetails[partId] ? { name: partsDetails[partId].name, status: partsDetails[partId].status } : {})
        })),
        last_addressed: rel.last_addressed,
        created_at: rel.created_at,
        updated_at: rel.updated_at,
      }
    })

    return formatted
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}
