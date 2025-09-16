import { z } from 'zod'
import type { Database, PartRow, PartRelationshipRow } from '@/lib/types/database'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'

function getSupabaseClient() {
  // Always use browser client in this client-safe module
  return createBrowserSupabase()
}

// Lightweight schemas (for basic validation only where needed)
const searchPartsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['emerging', 'acknowledged', 'active', 'integrated']).optional(),
  category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
  limit: z.number().min(1).max(50).default(20),
})

const getPartByIdSchema = z.object({
  partId: z.string().uuid(),
})

const getPartRelationshipsSchema = z.object({
  userId: z.string().uuid().optional(),
  partId: z.string().uuid().optional(),
  relationshipType: z.enum(['polarized', 'protector-exile', 'allied']).optional(),
  status: z.enum(['active', 'healing', 'resolved']).optional(),
  includePartDetails: z.boolean().default(false),
  limit: z.number().min(1).max(50).default(20),
})

export async function searchParts(input: z.infer<typeof searchPartsSchema>): Promise<PartRow[]> {
  try {
    const validated = searchPartsSchema.parse(input)
    const supabase = getSupabaseClient()

    let query = supabase
      .from('parts')
      .select('*')
      .order('last_active', { ascending: false })
      .limit(validated.limit)

    if (validated.query) {
      query = query.or(`name.ilike.%${validated.query}%,role.ilike.%${validated.query}%`)
    }
    if (validated.status) {
      query = query.eq('status', validated.status)
    }
    if (validated.category) {
      query = query.eq('category', validated.category)
    }

    const { data, error } = await query
    if (error) throw new Error(`Database error: ${error.message}`)

    return (data as any) || []
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

export async function getPartById(input: z.infer<typeof getPartByIdSchema>): Promise<PartRow | null> {
  try {
    const validated = getPartByIdSchema.parse(input)
    const supabase = getSupabaseClient()

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

    return data as any
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

export async function getPartRelationships(input: z.infer<typeof getPartRelationshipsSchema>): Promise<Array<any>> {
  try {
    const validated = getPartRelationshipsSchema.parse(input)
    const supabase = getSupabaseClient()

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

    let relationships = (data || []) as any[]

    if (validated.partId) {
      const pid = validated.partId
      relationships = relationships.filter((rel: any) => Array.isArray(rel.parts) && rel.parts.includes(pid))
    }

    // Optionally fetch basic part details
    let partsDetails: Record<string, { name: string; status: string }> = {}
    if (validated.includePartDetails) {
      const allPartIds = relationships.reduce((acc, rel) => {
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

    const formatted = relationships.map(rel => {
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

