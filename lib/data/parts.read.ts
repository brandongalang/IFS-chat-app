import 'server-only'

import { z } from 'zod'

import { resolveUserId, devLog, dev } from '@/config/dev'
import { isMemoryV2Enabled } from '@/lib/memory/config'
import { recordSnapshotUsage } from '@/lib/memory/observability'
import type { PartRow, PartNoteRow } from '../types/database'
import { getSupabaseClient } from './parts.common'

// Input schemas for read-only operations
const searchPartsSchema = z.object({
  query: z.string().optional().describe('Search query for part names or roles'),
  status: z.enum(['emerging', 'acknowledged', 'active', 'integrated']).optional().describe('Filter by part status'),
  category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional().describe('Filter by part category'),
  limit: z.number().min(1).max(50).default(20).describe('Maximum number of results to return'),
  userId: z.string().uuid().optional().describe('User ID for the search (optional in development mode)'),
})

const getPartByIdSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
})

const getPartDetailSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve details for'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
})

const getPartNotesSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve notes for'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
})

/**
 * Search for parts based on various criteria
 */
export async function searchParts(input: z.infer<typeof searchPartsSchema>): Promise<PartRow[]> {
  try {
    const validated = searchPartsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    devLog('searchParts called', { userId, query: validated.query })

    let query = supabase
      .from('parts')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false })
      .limit(validated.limit)

    // Apply filters
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

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return data || []
  } catch (error) {
    const errMsg =
      error instanceof Error ? (dev.verbose ? error.stack || error.message : error.message) : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Get a specific part by ID
 */
export async function getPartById(input: z.infer<typeof getPartByIdSchema>): Promise<any | null> {
  try {
    const validated = getPartByIdSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    devLog('getPartById called', { userId, partId: validated.partId })

    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('id', validated.partId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Database error: ${error.message}`)
    }

    // Optionally enrich with snapshot sections (Memory V2 — server-only)
    let snapshot_sections: any = undefined
    if (typeof window === 'undefined' && isMemoryV2Enabled() && data) {
      const t0 = Date.now()
      try {
        const { readPartProfileSections } = await import('@/lib/memory/read')
        snapshot_sections = await readPartProfileSections(userId, validated.partId)
        recordSnapshotUsage('part_profile', snapshot_sections ? 'hit' : 'miss', {
          latencyMs: Date.now() - t0,
          userId,
          partId: validated.partId,
        })
      } catch (e) {
        recordSnapshotUsage('part_profile', 'error', {
          latencyMs: Date.now() - t0,
          userId,
          partId: validated.partId,
          error: e,
        })
        try {
          devLog('readPartProfileSections error', { e })
        } catch {}
      }
    }

    return snapshot_sections ? { ...data, snapshot_sections } : data
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Get a specific part by ID along with its relationships
 */
export async function getPartDetail(input: z.infer<typeof getPartDetailSchema>): Promise<any> {
  try {
    const validated = getPartDetailSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    devLog('getPartDetail called', { userId, partId: validated.partId })

    // Fetch the part itself
    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', validated.partId)
      .eq('user_id', userId)
      .single()

    if (partError) {
      throw new Error(`Database error (part): ${partError.message}`)
    }
    if (!part) {
      throw new Error('Part not found')
    }

    // Fetch relationships involving this part
    const { data: relationships, error: relationshipsError } = await supabase
      .from('part_relationships')
      .select('*')
      .eq('user_id', userId)
      .contains('parts', [validated.partId])

    if (relationshipsError) {
      throw new Error(`Database error (relationships): ${relationshipsError.message}`)
    }

    // Optionally enrich with snapshot sections (Memory V2 — server-only)
    let overview_sections: any = undefined
    let part_profile_sections: any = undefined
    let relationship_profiles: Record<string, any> | undefined = undefined
    if (typeof window === 'undefined' && isMemoryV2Enabled()) {
      const t0 = Date.now()
      try {
        const rels = relationships || []
        const { readOverviewSections, readPartProfileSections, readRelationshipProfileSections } = await import('@/lib/memory/read')
        const reads = [
          (async () => {
            const s = await readOverviewSections(userId)
            recordSnapshotUsage('overview', s ? 'hit' : 'miss', { latencyMs: Date.now() - t0, userId })
            return s
          })(),
          (async () => {
            const s = await readPartProfileSections(userId, validated.partId)
            recordSnapshotUsage('part_profile', s ? 'hit' : 'miss', {
              latencyMs: Date.now() - t0,
              userId,
              partId: validated.partId,
            })
            return s
          })(),
          Promise.all(
            rels.map(async r => {
              const tRel = Date.now()
              try {
                const m = await readRelationshipProfileSections(userId, (r as any).id)
                recordSnapshotUsage('relationship_profile', m ? 'hit' : 'miss', {
                  latencyMs: Date.now() - tRel,
                  userId,
                  relId: (r as any).id,
                })
                return m
              } catch (e) {
                recordSnapshotUsage('relationship_profile', 'error', {
                  latencyMs: Date.now() - tRel,
                  userId,
                  relId: (r as any).id,
                  error: e,
                })
                return null
              }
            })
          ),
        ] as const
        const [ovv, partProf, relMaps] = await Promise.all(reads)
        overview_sections = ovv || undefined
        part_profile_sections = partProf || undefined
        if (relMaps && relMaps.length > 0) {
          relationship_profiles = {}
          rels.forEach((r, idx) => {
            const m = relMaps[idx]
            if (m) relationship_profiles![(r as any).id] = m
          })
        }
      } catch (e) {
        try {
          devLog('snapshot read (detail) error', { e })
        } catch {}
      }
    }

    return {
      ...part,
      relationships: relationships || [],
      ...(overview_sections || part_profile_sections || relationship_profiles
        ? { snapshots: { overview_sections, part_profile_sections, relationship_profiles } }
        : {}),
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Fetch clarification notes for a part ordered from newest to oldest
 */
export async function getPartNotes(input: z.infer<typeof getPartNotesSchema>): Promise<PartNoteRow[]> {
  try {
    const validated = getPartNotesSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    devLog('getPartNotes called', { userId, partId: validated.partId })

    const { data, error } = await supabase
      .from('part_notes')
      .select('id, part_id, content, created_at, parts!inner(user_id)')
      .eq('part_id', validated.partId)
      .eq('parts.user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const notes = (data || []).map((note: any) => ({
      id: note.id,
      part_id: note.part_id,
      content: note.content,
      created_at: note.created_at,
    })) as PartNoteRow[]

    return notes
  } catch (error) {
    const errMsg =
      error instanceof Error ? (dev.verbose ? error.stack || error.message : error.message) : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

