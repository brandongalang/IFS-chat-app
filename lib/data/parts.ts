import 'server-only'

import { requiresUserConfirmation, devLog, dev } from '@/config/dev'
import { getSupabaseServiceRoleKey } from '@/lib/supabase/config'
import { isMemoryV2Enabled } from '@/lib/memory/config'
import { recordSnapshotUsage } from '@/lib/memory/observability'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
// TODO(ifs-chat-app-5): Migrate this module to PRD helpers (`parts_v2`, `part_relationships_v2`).
// The current implementation still relies on legacy tables and column shapes to support rich
// story/evidence fields and action logging; keep new server code from depending on it until the
// PRD-backed replacements can supply equivalent data.
import type {
  PartRow,
  PartInsert,
  PartUpdate,
  PartRelationshipRow,
  PartRelationshipInsert,
  PartRelationshipUpdate,
  RelationshipDynamic,
  PartNoteRow,
} from '../types/database'
import { buildPartsQuery, type PartQueryFilters } from './parts-query'
import {
  searchPartsSchema,
  getPartByIdSchema,
  getPartDetailSchema,
  createEmergingPartSchema,
  updatePartSchema,
  getPartRelationshipsSchema,
  getPartNotesSchema,
  logRelationshipSchema,
  type SearchPartsInput,
  type SearchPartsResult,
  type GetPartByIdInput,
  type GetPartByIdResult,
  type GetPartDetailInput,
  type GetPartDetailResult,
  type CreateEmergingPartInput,
  type CreateEmergingPartResult,
  type UpdatePartInput,
  type UpdatePartResult,
  type GetPartRelationshipsInput,
  type GetPartRelationshipsResult,
  type GetPartNotesInput,
  type GetPartNotesResult,
  type LogRelationshipInput,
  type LogRelationshipResult,
} from './parts.schema'

type PartsDataDependencies = {
  client: SupabaseDatabaseClient
  userId: string
}

function assertDependencies(deps: PartsDataDependencies): PartsDataDependencies {
  if (!deps || !deps.client) {
    throw new Error('Supabase client is required for parts data operations')
  }
  if (!deps.userId) {
    throw new Error('userId is required for parts data operations')
  }
  return deps
}

async function getActionLogger(client: SupabaseDatabaseClient) {
  const { createActionLogger } = await import('../database/action-logger')
  return createActionLogger(client)
}

/**
 * Search for parts based on various criteria
 */
export async function searchParts(input: SearchPartsInput, deps: PartsDataDependencies): Promise<SearchPartsResult> {
  try {
    const validated = searchPartsSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

    devLog('searchParts called', { userId, query: validated.query })

    const filters: PartQueryFilters = {
      name: validated.query,
      status: validated.status,
      category: validated.category,
      limit: validated.limit,
    }

    const { data, error } = await buildPartsQuery(supabase, filters).eq('user_id', userId)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return (data || []) as SearchPartsResult
  } catch (error) {
    const errMsg = error instanceof Error ? (dev.verbose ? (error.stack || error.message) : error.message) : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Get a specific part by ID
 */
export async function getPartById(input: GetPartByIdInput, deps: PartsDataDependencies): Promise<GetPartByIdResult> {
  try {
    const validated = getPartByIdSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

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
        recordSnapshotUsage('part_profile', snapshot_sections ? 'hit' : 'miss', { latencyMs: Date.now() - t0, userId, partId: validated.partId })
      } catch (e) {
        recordSnapshotUsage('part_profile', 'error', { latencyMs: Date.now() - t0, userId, partId: validated.partId, error: e })
        try { devLog('readPartProfileSections error', { e }) } catch {}
      }
    }

    if (!data) {
      return null
    }

    const typedData = data as PartRow
    const result = snapshot_sections ? { ...typedData, snapshot_sections } : typedData
    return result as GetPartByIdResult
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Get a specific part by ID along with its relationships
 */
export async function getPartDetail(input: GetPartDetailInput, deps: PartsDataDependencies): Promise<GetPartDetailResult> {
  try {
    const validated = getPartDetailSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

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
          (async () => { const s = await readOverviewSections(userId); recordSnapshotUsage('overview', s ? 'hit' : 'miss', { latencyMs: Date.now() - t0, userId }); return s })(),
          (async () => { const s = await readPartProfileSections(userId, validated.partId); recordSnapshotUsage('part_profile', s ? 'hit' : 'miss', { latencyMs: Date.now() - t0, userId, partId: validated.partId }); return s })(),
          Promise.all(rels.map(async (r) => {
            const tRel = Date.now()
            try {
              const m = await readRelationshipProfileSections(userId, (r as any).id)
              recordSnapshotUsage('relationship_profile', m ? 'hit' : 'miss', { latencyMs: Date.now() - tRel, userId, relId: (r as any).id })
              return m
            } catch (e) {
              recordSnapshotUsage('relationship_profile', 'error', { latencyMs: Date.now() - tRel, userId, relId: (r as any).id, error: e })
              return null
            }
          }))
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
      } catch (e) { try { devLog('snapshot read (detail) error', { e }) } catch {} }
    }

    const partData = part as PartRow
    const relationshipData = (relationships || []) as PartRelationshipRow[]
    const snapshots = overview_sections || part_profile_sections || relationship_profiles
      ? { overview_sections, part_profile_sections, relationship_profiles }
      : undefined

    return {
      ...partData,
      relationships: relationshipData,
      ...(snapshots ? { snapshots } : {}),
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Create an emerging part with 3+ evidence rule enforcement
 */
export async function createEmergingPart(input: CreateEmergingPartInput, deps: PartsDataDependencies): Promise<CreateEmergingPartResult> {
  try {
    const validated = createEmergingPartSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

    // Enforce 3+ evidence rule
    if (validated.evidence.length < 3) {
      throw new Error('Cannot create emerging part: At least 3 pieces of evidence are required')
    }

    // Check user confirmation (always required - should happen through chat)
    if (requiresUserConfirmation(validated.userConfirmed)) {
      throw new Error('Cannot create emerging part: User confirmation is required through chat interaction')
    }

    devLog('createEmergingPart called', { userId, partName: validated.name, evidenceCount: validated.evidence.length })

    // Check if part with same name already exists for this user
    const { data: existingPart } = await supabase
      .from('parts')
      .select('id, name')
      .eq('user_id', userId)
      .eq('name', validated.name)
      .single()

    if (existingPart) {
      throw new Error(`A part named "${validated.name}" already exists for this user`)
    }

    // Calculate initial confidence based on evidence quality
    const avgEvidenceConfidence = validated.evidence.reduce((sum, ev) => sum + ev.confidence, 0) / validated.evidence.length
    const initialConfidence = Math.min(0.95, avgEvidenceConfidence * 0.8) // Cap at 95% for emerging parts

    // Create the part
    const partInsert: PartInsert = {
      user_id: userId,
      name: validated.name,
      status: 'emerging',
      category: validated.category,
      age: validated.age,
      role: validated.role,
      triggers: validated.triggers,
      emotions: validated.emotions,
      beliefs: validated.beliefs,
      somatic_markers: validated.somaticMarkers,
      confidence: initialConfidence,
      evidence_count: validated.evidence.length,
      recent_evidence: validated.evidence,
      story: {
        origin: null,
        currentState: `Newly discovered part with ${validated.evidence.length} pieces of evidence`,
        purpose: validated.role || null,
        evolution: [{
          timestamp: new Date().toISOString(),
          change: 'Part created',
          trigger: 'Evidence threshold reached'
        }]
      },
      visualization: {
        emoji: '🤗',
        color: '#6B7280',
        energyLevel: 0.5
      }
    }

    // Use action logger for INSERT with rollback capability
    const actionLogger = await getActionLogger(supabase)
    const data = await actionLogger.loggedInsert<PartRow>(
      'parts',
      partInsert as any,
      userId,
      'create_emerging_part',
      {
        partName: validated.name,
        changeDescription: `Created emerging part with ${validated.evidence.length} pieces of evidence`,
        sessionId: validated.evidence[0]?.sessionId,
        evidenceCount: validated.evidence.length,
        category: validated.category,
        confidence: initialConfidence
      }
    )

    return data
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

type UpdateFields = UpdatePartInput['updates']
type UpdatePatch = Partial<PartUpdate> & Record<string, unknown>

function mergeVisualization(currentPart: PartRow, visualization?: UpdateFields['visualization']): UpdatePatch {
  if (!visualization) {
    return {}
  }

  const baseVisualization = (currentPart.visualization as PartRow['visualization'] | null) ?? null
  const merged = {
    ...(baseVisualization ?? {}),
    ...visualization,
  } as PartRow['visualization']

  if (typeof merged.energyLevel !== 'number') {
    merged.energyLevel = baseVisualization?.energyLevel ?? 0.5
  }

  return { visualization: merged }
}

function adjustConfidence(currentPart: PartRow, confidenceBoost?: number): UpdatePatch {
  if (typeof confidenceBoost !== 'number') {
    return {}
  }

  return {
    confidence: Math.min(1.0, Math.max(0, currentPart.confidence + confidenceBoost))
  }
}

function applyEvidence(currentPart: PartRow, newEvidence?: UpdatePartInput['evidence']): UpdatePatch {
  if (!newEvidence) {
    return {}
  }

  const currentEvidence = Array.isArray(currentPart.recent_evidence) ? currentPart.recent_evidence : []
  const updatedEvidence = [...currentEvidence, newEvidence].slice(-10)

  return {
    recent_evidence: updatedEvidence,
    evidence_count: currentPart.evidence_count + 1,
  }
}

function appendStoryEntry(currentStory: PartRow['story'] | null | undefined, auditNote: string | undefined, timestamp: string): UpdatePatch {
  const fallbackStory = {
    origin: null,
    currentState: null,
    purpose: null,
    evolution: [] as Array<{ timestamp: string; change: string; trigger?: string }>,
  }

  const baseStory = (currentStory ?? fallbackStory) as PartRow['story']
  const currentEvolution = Array.isArray(baseStory.evolution) ? baseStory.evolution : []
  const evolutionEntry = {
    timestamp,
    change: auditNote || 'Part updated',
    trigger: 'Agent tool update',
  }

  return {
    story: {
      ...baseStory,
      evolution: [...currentEvolution, evolutionEntry],
    },
  }
}

function normalizeSomaticMarkers(somaticMarkers?: string[]): UpdatePatch {
  if (!somaticMarkers) {
    return {}
  }

  return { somatic_markers: somaticMarkers }
}

function combineUpdatePatches(patches: UpdatePatch[]): UpdatePatch {
  return patches.reduce<UpdatePatch>((acc, patch) => ({ ...acc, ...patch }), {} as UpdatePatch)
}

/**
 * Update a part with confidence increment and audit trail
 */
export async function updatePart(input: UpdatePartInput, deps: PartsDataDependencies): Promise<UpdatePartResult> {
  try {
    const validated = updatePartSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

    devLog('updatePart called', { userId, partId: validated.partId })

    // First, get the current part
    const { data: currentPart, error: fetchError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', validated.partId)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch part: ${fetchError.message}`)
    }

    if (!currentPart) {
      throw new Error('Part not found or access denied')
    }

    const {
      visualization,
      confidenceBoost,
      somaticMarkers,
      ...attributeUpdates
    } = validated.updates

    const nowIso = new Date().toISOString()

    const baseUpdates: UpdatePatch = {
      ...attributeUpdates,
      last_active: nowIso,
    }

    const updates = combineUpdatePatches([
      baseUpdates,
      mergeVisualization(currentPart, visualization),
      adjustConfidence(currentPart, confidenceBoost),
      applyEvidence(currentPart, validated.evidence),
      appendStoryEntry(currentPart.story, validated.auditNote, nowIso),
      normalizeSomaticMarkers(somaticMarkers),
    ])

    // Determine action type and generate change description
    let actionType: 'update_part_confidence' | 'update_part_category' | 'update_part_attributes' | 'add_part_evidence' | 'update_part_charge' = 'update_part_attributes'
    let changeDescription = 'Updated part attributes'
    
    if (validated.updates.name && validated.updates.name !== currentPart.name) {
      changeDescription = `renamed part from "${currentPart.name}" to "${validated.updates.name}"`
    } else if (validated.updates.visualization) {
      changeDescription = 'updated part visualization'
    } else if (typeof validated.updates.last_charge_intensity === 'number') {
      actionType = 'update_part_charge'
      changeDescription = `updated part charge to ${validated.updates.last_charge_intensity.toFixed(2)}`
    } else if (typeof confidenceBoost === 'number') {
      actionType = 'update_part_confidence'
      const toVal = (updates.confidence ?? currentPart.confidence)
      const direction = confidenceBoost >= 0 ? 'increased' : 'decreased'
      changeDescription = `${direction} confidence from ${currentPart.confidence} to ${toVal}`
    } else if (validated.updates.category && validated.updates.category !== currentPart.category) {
      actionType = 'update_part_category'
      changeDescription = `changed category from ${currentPart.category} to ${validated.updates.category}`
    } else if (validated.evidence) {
      actionType = 'add_part_evidence'
      changeDescription = `added evidence: ${validated.evidence.content.substring(0, 50)}...`
    }

    // Use action logger for UPDATE with rollback capability
    const actionLogger = await getActionLogger(supabase)
    const data = await actionLogger.loggedUpdate<PartRow>(
      'parts',
      validated.partId,
      updates as any,
      userId,
      actionType as any,
      {
        partName: currentPart.name,
        changeDescription,
        confidenceDelta: confidenceBoost,
        categoryChange: validated.updates.category ? {
          from: currentPart.category,
          to: validated.updates.category
        } : undefined,
        evidenceAdded: !!validated.evidence,
        fieldChanged: Object.keys(validated.updates).join(', '),
        auditNote: validated.auditNote
      }
    )

    return data
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Get part relationships with optional filtering and part details
 */
export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsDataDependencies
): Promise<GetPartRelationshipsResult> {
  try {
    const validated = getPartRelationshipsSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

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

    const relationshipRows = (relationships || []) as PartRelationshipRow[]

    if (relationshipRows.length === 0) {
      return []
    }

    // Optional client-side filter by partId
    let filtered: PartRelationshipRow[] = relationshipRows
    if (validated.partId) {
      const pid = validated.partId
      filtered = relationshipRows.filter(rel => {
        const partIds = Array.isArray(rel.parts) ? rel.parts : []
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
          filtered.map(async rel => {
            const tRel = Date.now()
            try {
              const m = await readRelationshipProfileSections(userId, rel.id)
              recordSnapshotUsage('relationship_profile', m ? 'hit' : 'miss', { latencyMs: Date.now() - tRel, userId, relId: rel.id })
              return m
            } catch (e) {
              recordSnapshotUsage('relationship_profile', 'error', { latencyMs: Date.now() - tRel, userId, relId: rel.id, error: e })
              return null
            }
          })
        )
      } catch (e) { try { devLog('snapshot read (relationships) error', { e }) } catch {} }
    }

    // Format response with optional part details and snapshot sections
    const formattedRelationships: GetPartRelationshipsResult = filtered.map((rel, idx) => {
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
        dynamics: (rel.dynamics as RelationshipDynamic[]) || [],
        parts: partIds.map((partId: string) => ({
          id: partId,
          ...(validated.includePartDetails && partsDetails[partId] ? {
            name: partsDetails[partId].name,
            status: partsDetails[partId].status
          } : {})
        })),
        last_addressed: rel.last_addressed,
        created_at: rel.created_at,
        updated_at: rel.updated_at,
        ...(snapshot_sections ? { snapshot_sections } : {})
      }
    })

    return formattedRelationships
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Fetch clarification notes for a part ordered from newest to oldest
 */
export async function getPartNotes(input: GetPartNotesInput, deps: PartsDataDependencies): Promise<GetPartNotesResult> {
  try {
    const validated = getPartNotesSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

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
    })) as GetPartNotesResult

    return notes
  } catch (error) {
    const errMsg =
      error instanceof Error
        ? (dev.verbose ? error.stack || error.message : error.message)
        : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

/**
 * Create or update a part relationship, optionally appending a dynamic observation
 */
export async function logRelationship(input: LogRelationshipInput, deps: PartsDataDependencies): Promise<LogRelationshipResult> {
  try {
    const validated = logRelationshipSchema.parse(input)
    const { client: supabase, userId } = assertDependencies(deps)

    // Normalize part IDs for stable matching
    const partIds = [...validated.partIds].sort()
    const nowIso = new Date().toISOString()
    const dyn: RelationshipDynamic | undefined = validated.dynamic
      ? {
          timestamp: validated.dynamic.timestamp || nowIso,
          observation: validated.dynamic.observation,
          context: validated.dynamic.context,
          polarizationChange: typeof validated.dynamic.polarizationChange === 'number' ? validated.dynamic.polarizationChange : undefined
        }
      : undefined

    try { devLog('logRelationship called', { userId, partIds, type: validated.type }) } catch {}

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
      existing = (candidates || []).find((r: any) => {
        const p = Array.isArray(r?.parts) ? (r.parts as string[]) : []
        if (p.length !== 2) return false
        const sorted = [...p].sort()
        return sorted[0] === partIds[0] && sorted[1] === partIds[1]
      }) as any || null
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
      const delta = dyn && typeof dyn.polarizationChange === 'number' ? parseFloat(String(dyn.polarizationChange)) : undefined
      const computedPol = typeof providedAbs === 'number'
        ? parseFloat(String(providedAbs))
        : (typeof delta === 'number' ? Math.min(1, Math.max(0, currentPol + delta)) : currentPol)
      try { devLog('logRelationship polarization compute', { currentPol, computedPol, delta, types: { current: typeof currentPol, computed: typeof computedPol, deltaType: typeof delta } }) } catch {}
      if (!dev.disablePolarizationUpdate) {
        if (computedPol !== currentPol) (updates as any).polarization_level = computedPol
      }

      // Always bump updated_at
      ;(updates as any).updated_at = nowIso

      // Dev bypass with service role to avoid RLS, and manual action log
      const serviceRole = getSupabaseServiceRoleKey()
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
              changeDescription: dyn ? `Appended dynamic: ${dyn.observation.substring(0, 60)}...` : 'Updated relationship fields',
              polarizationDelta,
              type: validated.type,
              partIds
            },
            created_by: 'agent'
          })

          return updatedDirect as LogRelationshipResult
        } catch (e: any) {
          throw new Error(`UPDATE_BRANCH: ${e?.stack || e?.message || String(e)}`)
        }
      }

      try {
        const actionLogger = await getActionLogger(supabase)
        const updated = await actionLogger.loggedUpdate<PartRelationshipRow>(
          'part_relationships',
          existing.id,
          updates as any,
          userId,
          'update_relationship',
          {
            changeDescription: dyn ? `Appended dynamic: ${dyn.observation.substring(0, 60)}...` : 'Updated relationship fields',
            polarizationDelta,
            type: validated.type,
            partIds
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
      polarization_level: typeof validated.polarizationLevel === 'number' ? validated.polarizationLevel : 0.5,
      last_addressed: validated.lastAddressed || (dyn ? dyn.timestamp : null),
      created_at: nowIso,
      updated_at: nowIso
    }

    // Dev bypass with service role to avoid RLS, and manual action log
    const serviceRoleCreate = getSupabaseServiceRoleKey()
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
          partIds
        },
        created_by: 'agent'
      })

      return createdDirect as LogRelationshipResult
    }

    const actionLogger = await getActionLogger(supabase)
    const created = await actionLogger.loggedInsert<PartRelationshipRow>(
      'part_relationships',
      insert as any,
      userId,
      'create_relationship',
      {
        changeDescription: `Created ${validated.type} relationship between parts` ,
        type: validated.type,
        partIds
      }
    )

    return created
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

// (Mastra tool definitions exist separately in mastra/tools/part-tools.mastra.ts)
