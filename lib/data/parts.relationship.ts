import 'server-only'

import { z } from 'zod'

import { resolveUserId, devLog, dev } from '@/config/dev'
import { isMemoryV2Enabled } from '@/lib/memory/config'
import { recordSnapshotUsage } from '@/lib/memory/observability'
import type {
  PartRelationshipRow,
  PartRelationshipInsert,
  PartRelationshipUpdate,
  RelationshipDynamic,
} from '../types/database'
import { getSupabaseClient } from './parts.common'

const getPartRelationshipsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID to get relationships for (optional in development mode)'),
  partId: z.string().uuid().optional().describe('Optional: Get relationships for specific part'),
  relationshipType: z
    .enum(['polarized', 'protector-exile', 'allied'])
    .optional()
    .describe('Optional: Filter by relationship type'),
  status: z.enum(['active', 'healing', 'resolved']).optional().describe('Optional: Filter by relationship status'),
  includePartDetails: z.boolean().default(false).describe('Include part names and status in response'),
  limit: z.number().min(1).max(50).default(20).describe('Maximum number of relationships to return'),
})

const logRelationshipSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID who owns the relationship (optional in development mode)'),
  partIds: z
    .array(z.string().uuid())
    .min(2)
    .max(2)
    .describe('Exactly two part IDs involved in the relationship'),
  type: z.enum(['polarized', 'protector-exile', 'allied']).describe('Relationship type'),
  description: z.string().optional().describe('Short description of the relationship'),
  issue: z.string().optional().describe('Primary point of conflict or issue'),
  commonGround: z.string().optional().describe('Areas of agreement or shared goals'),
  status: z.enum(['active', 'healing', 'resolved']).optional().describe('Relationship status'),
  polarizationLevel: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Absolute polarization level to set (0..1)'),
  dynamic: z
    .object({
      observation: z.string().min(1).describe('What was noticed about the interaction'),
      context: z.string().min(1).describe('Context where this dynamic occurred'),
      polarizationChange: z
        .number()
        .min(-1)
        .max(1)
        .optional()
        .describe('Relative change in polarization (-1..1)'),
      timestamp: z
        .string()
        .datetime()
        .optional()
        .describe('When this dynamic occurred (defaults to now)'),
    })
    .optional(),
  lastAddressed: z
    .string()
    .datetime()
    .optional()
    .describe('When this relationship was last addressed'),
  upsert: z.boolean().default(true).describe('Update existing relationship if it exists; otherwise create'),
})

/**
 * Get part relationships with optional filtering and part details
 */
export async function getPartRelationships(input: z.infer<typeof getPartRelationshipsSchema>): Promise<Array<any>> {
  try {
    const validated = getPartRelationshipsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    devLog('getPartRelationships called', { userId, partId: validated.partId })

    // Build base query
    let query = supabase
      .from('part_relationships')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(validated.limit)

    // Apply filters (avoid JSON contains due to server inconsistencies; filter by partId client-side below)

    if (validated.relationshipType) {
      query = query.eq('type', validated.relationshipType)
    }

    if (validated.status) {
      query = query.eq('status', validated.status)
    }

    const { data: relationships, error } = await query

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!relationships || relationships.length === 0) {
      return []
    }

    // Optional client-side filter by partId
    let filtered = relationships
    if (validated.partId) {
      const pid = validated.partId
      filtered = (relationships as any[]).filter(rel => {
        const partIds = Array.isArray((rel as any).parts) ? (rel as any).parts : []
        return partIds.includes(pid)
      })
    }

    // If part details are requested, fetch them efficiently
    let partsDetails: Record<string, { name: string; status: string }> = {}

    if (validated.includePartDetails) {
      // Get all unique part IDs from all relationships
      const allPartIds = filtered.reduce((acc, rel) => {
        const partIds = Array.isArray(rel.parts) ? rel.parts : []
        return [...acc, ...partIds]
      }, [] as string[])

      const uniquePartIds = [...new Set(allPartIds)]

      if (uniquePartIds.length > 0) {
        const { data: parts, error: partsError } = await supabase
          .from('parts')
          .select('id, name, status')
          .eq('user_id', userId)
          .in('id', uniquePartIds)

        if (partsError) {
          throw new Error(`Error fetching part details: ${partsError.message}`)
        }

        // Create lookup map
        partsDetails = (parts || []).reduce((acc, part) => {
          acc[part.id] = { name: part.name, status: part.status }
          return acc
        }, {} as Record<string, { name: string; status: string }>)
      }
    }

    // Optionally enrich each relationship with snapshot sections (Memory V2)
    let relSectionMaps: Array<any> | undefined
    if (typeof window === 'undefined' && isMemoryV2Enabled()) {
      try {
        const { readRelationshipProfileSections } = await import('@/lib/memory/read')
        relSectionMaps = await Promise.all(
          (filtered as any[]).map(async rel => {
            const tRel = Date.now()
            try {
              const m = await readRelationshipProfileSections(userId, (rel as any).id)
              recordSnapshotUsage('relationship_profile', m ? 'hit' : 'miss', {
                latencyMs: Date.now() - tRel,
                userId,
                relId: (rel as any).id,
              })
              return m
            } catch (e) {
              recordSnapshotUsage('relationship_profile', 'error', {
                latencyMs: Date.now() - tRel,
                userId,
                relId: (rel as any).id,
                error: e,
              })
              return null
            }
          })
        )
      } catch (e) {
        try {
          devLog('snapshot read (relationships) error', { e })
        } catch {}
      }
    }

    // Format response with optional part details and snapshot sections
    const formattedRelationships = filtered.map((rel, idx) => {
      const partIds = Array.isArray(rel.parts) ? rel.parts : []
      const snapshot_sections = relSectionMaps ? relSectionMaps[idx] : undefined

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
            ? {
                name: partsDetails[partId].name,
                status: partsDetails[partId].status,
              }
            : {}),
        })),
        last_addressed: rel.last_addressed,
        created_at: rel.created_at,
        updated_at: rel.updated_at,
        ...(snapshot_sections ? { snapshot_sections } : {}),
      }
    })

    return formattedRelationships
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Create or update a part relationship, optionally appending a dynamic observation
 */
export async function logRelationship(input: z.infer<typeof logRelationshipSchema>): Promise<PartRelationshipRow> {
  try {
    const validated = logRelationshipSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    // Normalize part IDs for stable matching
    const partIds = [...validated.partIds].sort()
    const nowIso = new Date().toISOString()
    const dyn: RelationshipDynamic | undefined = validated.dynamic
      ? {
          timestamp: validated.dynamic.timestamp || nowIso,
          observation: validated.dynamic.observation,
          context: validated.dynamic.context,
          polarizationChange:
            typeof validated.dynamic.polarizationChange === 'number'
              ? validated.dynamic.polarizationChange
              : undefined,
        }
      : undefined

    try {
      devLog('logRelationship called', { userId, partIds, type: validated.type })
    } catch {}

    // Try to find an existing relationship if upsert
    let existing: PartRelationshipRow | null = null
    if (validated.upsert) {
      // Fetch recent relationships of same type and filter client-side for exact part pair match
      const { data: candidates, error: findErr } = await supabase
        .from('part_relationships')
        .select('*')
        .eq('user_id', userId)
        .eq('type', validated.type)
        .order('created_at', { ascending: false })
        .limit(50)
      if (findErr) {
        throw new Error(`Database error (find): ${findErr.message}`)
      }
      existing =
        ((candidates || []).find((r: any) => {
          const p = Array.isArray(r?.parts) ? (r.parts as string[]) : []
          if (p.length !== 2) return false
          const sorted = [...p].sort()
          return sorted[0] === partIds[0] && sorted[1] === partIds[1]
        }) as any) || null
    }

    if (existing) {
      // Update existing relationship
      const updates: PartRelationshipUpdate = {}

      // Append dynamic if provided
      let polarizationDelta: number | undefined
      if (dyn) {
        const currentDynamics = (existing.dynamics as any[]) || []
        updates.dynamics = [...currentDynamics, dyn] as any
        updates.last_addressed = validated.lastAddressed || dyn.timestamp
        if (typeof dyn.polarizationChange === 'number') {
          polarizationDelta = dyn.polarizationChange
        }
      } else if (validated.lastAddressed) {
        updates.last_addressed = validated.lastAddressed
      }

      // Update descriptive fields if provided
      if (typeof validated.description === 'string') updates.description = validated.description
      if (typeof validated.issue === 'string') updates.issue = validated.issue
      if (typeof validated.commonGround === 'string') (updates as any).common_ground = validated.commonGround
      if (validated.status) updates.status = validated.status

      // Handle polarization level absolute or delta
      const currentPolRaw: any = (existing as any).polarization_level
      const currentPol = typeof currentPolRaw === 'number' ? currentPolRaw : parseFloat(String(currentPolRaw ?? 0.5))
      const providedAbs = validated.polarizationLevel
      const delta = dyn && typeof dyn.polarizationChange === 'number'
        ? parseFloat(String(dyn.polarizationChange))
        : undefined
      const computedPol =
        typeof providedAbs === 'number'
          ? parseFloat(String(providedAbs))
          : typeof delta === 'number'
            ? Math.min(1, Math.max(0, currentPol + delta))
            : currentPol
      try {
        devLog('logRelationship polarization compute', {
          currentPol,
          computedPol,
          delta,
          types: { current: typeof currentPol, computed: typeof computedPol, deltaType: typeof delta },
        })
      } catch {}
      if (!dev.disablePolarizationUpdate) {
        if (computedPol !== currentPol) (updates as any).polarization_level = computedPol
      }

      // Always bump updated_at
      ;(updates as any).updated_at = nowIso

      // Dev bypass with service role to avoid RLS, and manual action log
      const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (typeof window === 'undefined' && dev.enabled && serviceRole) {
        try {
          devLog('logRelationship update payload', updates)
          const { data: updatedDirect, error: updErr } = await supabase
            .from('part_relationships')
            .update(updates as any)
            .eq('id', existing.id)
            .eq('user_id', userId)
            .select('*')
            .single()
          if (updErr || !updatedDirect) {
            throw new Error(`Failed to update relationship (service role): ${updErr?.message || 'unknown'}`)
          }

          await supabase.from('agent_actions').insert({
            user_id: userId,
            action_type: 'update_relationship',
            target_table: 'part_relationships',
            target_id: existing.id,
            old_state: existing,
            new_state: updatedDirect,
            metadata: {
              changeDescription: dyn
                ? `Appended dynamic: ${dyn.observation.substring(0, 60)}...`
                : 'Updated relationship fields',
              polarizationDelta,
              type: validated.type,
              partIds,
            },
            created_by: 'agent',
          })

          return updatedDirect as any
        } catch (e: any) {
          throw new Error(`UPDATE_BRANCH: ${e?.stack || e?.message || String(e)}`)
        }
      }

      try {
        const { actionLogger } = await import('../database/action-logger')
        const updated = await actionLogger.loggedUpdate<PartRelationshipRow>(
          'part_relationships',
          existing.id,
          updates as any,
          userId,
          'update_relationship',
          {
            changeDescription: dyn
              ? `Appended dynamic: ${dyn.observation.substring(0, 60)}...`
              : 'Updated relationship fields',
            polarizationDelta,
            type: validated.type,
            partIds,
          }
        )
        return updated
      } catch (e: any) {
        throw new Error(`LOGGED_UPDATE_BRANCH: ${e?.stack || e?.message || String(e)}`)
      }
    }

    // Create new relationship
    const insert: PartRelationshipInsert = {
      user_id: userId,
      parts: partIds,
      type: validated.type,
      description: validated.description,
      issue: validated.issue || undefined,
      common_ground: validated.commonGround || undefined,
      dynamics: dyn ? [dyn] : [],
      status: validated.status || 'active',
      polarization_level:
        typeof validated.polarizationLevel === 'number' ? validated.polarizationLevel : 0.5,
      last_addressed: validated.lastAddressed || (dyn ? dyn.timestamp : null),
      created_at: nowIso,
      updated_at: nowIso,
    }

    // Dev bypass with service role to avoid RLS, and manual action log
    const serviceRoleCreate = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (typeof window === 'undefined' && dev.enabled && serviceRoleCreate) {
      const { data: createdDirect, error: insErr } = await supabase
        .from('part_relationships')
        .insert(insert as any)
        .select('*')
        .single()
      if (insErr || !createdDirect) {
        throw new Error(`Failed to create relationship (service role): ${insErr?.message || 'unknown'}`)
      }

      await supabase.from('agent_actions').insert({
        user_id: userId,
        action_type: 'create_relationship',
        target_table: 'part_relationships',
        target_id: createdDirect.id,
        old_state: null,
        new_state: createdDirect,
        metadata: {
          changeDescription: `Created ${validated.type} relationship between parts`,
          type: validated.type,
          partIds,
        },
        created_by: 'agent',
      })

      return createdDirect as any
    }

    const { actionLogger } = await import('../database/action-logger')
    const created = await actionLogger.loggedInsert<PartRelationshipRow>(
      'part_relationships',
      insert as any,
      userId,
      'create_relationship',
      {
        changeDescription: `Created ${validated.type} relationship between parts`,
        type: validated.type,
        partIds,
      }
    )

    return created
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

