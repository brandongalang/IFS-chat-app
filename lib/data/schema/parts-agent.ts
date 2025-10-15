import 'server-only'

import { requiresUserConfirmation, devLog, dev } from '@/config/dev'
import { getSupabaseServiceRoleKey } from '@/lib/supabase/config'
import { isMemoryV2Enabled } from '@/lib/memory/config'
import { recordSnapshotUsage } from '@/lib/memory/observability'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import type {
  PartRow,
  PartStory,
  PartVisualization,
  PartEvidence,
  PartRelationshipRow,
  RelationshipDynamic,
  RelationshipStatus,
  RelationshipType,
  PartNoteRow,
  Json,
} from '@/lib/types/database'
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
} from '@/lib/data/parts.schema'
import {
  searchPartsV2,
  getPartByIdV2,
} from './parts'
import { listRelationships as listRelationshipsV2 } from './relationships'
import type { PartRowV2, PartRelationshipRowV2 } from './types'

type PartsAgentDependencies = {
  client: SupabaseDatabaseClient
  userId: string
}

const DEFAULT_STORY: PartStory = {
  origin: null,
  currentState: null,
  purpose: null,
  evolution: [],
}

const DEFAULT_VISUALIZATION: PartVisualization = {
  emoji: '🤗',
  color: '#6B7280',
  energyLevel: 0.5,
}

const DEFAULT_RELATIONSHIP_STATUS: RelationshipStatus = 'active'

function assertAgentDeps(deps: PartsAgentDependencies): PartsAgentDependencies {
  if (!deps?.client) {
    throw new Error('Supabase client is required for agent part operations')
  }
  if (!deps?.userId) {
    throw new Error('userId is required for agent part operations')
  }
  return deps
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function coerceArray<T>(value: unknown, fallback: readonly T[] = []): T[] {
  if (Array.isArray(value)) return value as T[]
  return [...fallback]
}

function coerceStory(value: unknown): PartStory {
  if (!isPlainObject(value)) {
    return { ...DEFAULT_STORY }
  }
  const story = value as Partial<PartStory>
  return {
    origin: typeof story.origin === 'string' ? story.origin : null,
    currentState: typeof story.currentState === 'string' ? story.currentState : null,
    purpose: typeof story.purpose === 'string' ? story.purpose : null,
    evolution: Array.isArray(story.evolution)
      ? story.evolution.filter((entry): entry is PartStory['evolution'][number] =>
          isPlainObject(entry) &&
          typeof entry.timestamp === 'string' &&
          typeof entry.change === 'string'
        )
      : [],
  }
}

function coerceVisualization(value: unknown): PartVisualization {
  if (!isPlainObject(value)) {
    return { ...DEFAULT_VISUALIZATION }
  }
  const vis = value as Partial<PartVisualization>
  return {
    emoji: typeof vis.emoji === 'string' && vis.emoji.length > 0 ? vis.emoji : DEFAULT_VISUALIZATION.emoji,
    color: typeof vis.color === 'string' && vis.color.length > 0 ? vis.color : DEFAULT_VISUALIZATION.color,
    energyLevel:
      typeof vis.energyLevel === 'number' && Number.isFinite(vis.energyLevel)
        ? Math.max(0, Math.min(1, vis.energyLevel))
        : DEFAULT_VISUALIZATION.energyLevel,
  }
}

interface RelationshipContextPayload {
  description?: string | null
  issue?: string | null
  commonGround?: string | null
  status?: RelationshipStatus | null
  polarizationLevel?: number | null
  lastAddressed?: string | null
}

function parseRelationshipContext(raw: unknown): RelationshipContextPayload {
  if (typeof raw !== 'string') {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as RelationshipContextPayload
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return { description: raw }
  }
}

function encodeRelationshipContext(payload: RelationshipContextPayload): string | null {
  const pruned: RelationshipContextPayload = {
    description: payload.description ?? null,
    issue: payload.issue ?? null,
    commonGround: payload.commonGround ?? null,
    status: payload.status ?? null,
    polarizationLevel: typeof payload.polarizationLevel === 'number' ? payload.polarizationLevel : null,
    lastAddressed: payload.lastAddressed ?? null,
  }

  if (
    pruned.description === null &&
    pruned.issue === null &&
    pruned.commonGround === null &&
    pruned.status === null &&
    pruned.polarizationLevel === null &&
    pruned.lastAddressed === null
  ) {
    return null
  }

  return JSON.stringify(pruned)
}

interface RelationshipObservationsPayload {
  dynamics: RelationshipDynamic[]
}

function parseRelationshipObservations(raw: unknown): RelationshipDynamic[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const results: RelationshipDynamic[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      try {
        const parsed = JSON.parse(entry) as RelationshipObservationsPayload | RelationshipDynamic
        if (Array.isArray((parsed as RelationshipObservationsPayload).dynamics)) {
          results.push(...(parsed as RelationshipObservationsPayload).dynamics)
        } else if (
          isPlainObject(parsed) &&
          typeof (parsed as RelationshipDynamic).observation === 'string' &&
          typeof (parsed as RelationshipDynamic).context === 'string'
        ) {
          results.push(parsed as RelationshipDynamic)
        }
      } catch {
        // ignore malformed entries
      }
    }
  }
  return results
}

function encodeRelationshipDynamics(dynamics: RelationshipDynamic[]): string[] {
  if (!dynamics.length) return []
  return [JSON.stringify({ dynamics })]
}

type RelationshipTypeV2 = 'protects' | 'conflicts' | 'supports' | 'triggers' | 'soothes'

const RELATIONSHIP_TYPE_TO_V2: Record<RelationshipType, RelationshipTypeV2> = {
  polarized: 'conflicts',
  'protector-exile': 'protects',
  allied: 'supports',
}

const RELATIONSHIP_TYPE_FROM_V2: Record<RelationshipTypeV2, RelationshipType> = {
  protects: 'protector-exile',
  conflicts: 'polarized',
  supports: 'allied',
  triggers: 'polarized',
  soothes: 'allied',
}

function toV2RelationshipType(type: RelationshipType): RelationshipTypeV2 {
  return RELATIONSHIP_TYPE_TO_V2[type] ?? 'supports'
}

function fromV2RelationshipType(type: string | null | undefined): RelationshipType {
  if (!type) return 'allied'
  const cast = type as RelationshipTypeV2
  return RELATIONSHIP_TYPE_FROM_V2[cast] ?? 'allied'
}

function mapRelationshipRowLegacy(
  row: PartRelationshipRowV2,
  contextPayload: RelationshipContextPayload,
  dynamics: RelationshipDynamic[],
  polarization: number,
  partIds: string[]
): PartRelationshipRow {
  return {
    id: row.id,
    user_id: row.user_id,
    parts: partIds,
    type: fromV2RelationshipType(row.type),
    description: contextPayload.description ?? null,
    issue: contextPayload.issue ?? null,
    common_ground: contextPayload.commonGround ?? null,
    dynamics,
    status: contextPayload.status ?? DEFAULT_RELATIONSHIP_STATUS,
    polarization_level: polarization,
    last_addressed: contextPayload.lastAddressed ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapPartRow(row: PartRowV2): PartRow {
  const data = isPlainObject(row.data) ? (row.data as Record<string, unknown>) : {}
  const age = typeof data.age === 'number' ? data.age : null
  const role = typeof data.role === 'string' ? data.role : null
  const triggers = coerceArray<string>(data.triggers)
  const emotions = coerceArray<string>(data.emotions)
  const beliefs = coerceArray<string>(data.beliefs)
  const somaticMarkers = coerceArray<string>(data.somatic_markers)
  const recentEvidence = coerceArray<PartEvidence>(data.recent_evidence)
  const story = coerceStory(data.story)
  const visualization = coerceVisualization(data.visualization)
  const relationships = (data.relationships ?? null) as Json
  const acknowledgedAt = typeof data.acknowledged_at === 'string' ? data.acknowledged_at : null
  const lastInteractionAt = typeof data.last_interaction_at === 'string' ? data.last_interaction_at : null
  const lastChargedAt = typeof data.last_charged_at === 'string' ? data.last_charged_at : null
  const lastChargeIntensity = typeof data.last_charge_intensity === 'number' ? data.last_charge_intensity : null

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name ?? row.placeholder ?? 'Unnamed Part',
    status: row.status,
    category: row.category,
    age,
    role,
    triggers,
    emotions,
    beliefs,
    somatic_markers: somaticMarkers,
    confidence: row.confidence ?? 0,
    evidence_count: row.evidence_count ?? 0,
    recent_evidence: recentEvidence,
    story,
    relationships,
    visualization,
    first_noticed: row.first_noticed,
    acknowledged_at: acknowledgedAt,
    last_active: row.last_active ?? row.updated_at,
    last_interaction_at: lastInteractionAt,
    last_charged_at: lastChargedAt,
    last_charge_intensity: lastChargeIntensity,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function getActionLogger(client: SupabaseDatabaseClient) {
  const { createActionLogger } = await import('../../database/action-logger')
  return createActionLogger(client)
}

function buildPartDataPatch(current: PartRowV2, patch: Record<string, unknown>): Record<string, unknown> {
  const existing = isPlainObject(current.data) ? { ...(current.data as Record<string, unknown>) } : {}
  for (const [key, value] of Object.entries(patch)) {
    existing[key] = value
  }
  return existing
}

/**
 * Search parts for the current user using the PRD `parts_v2` table and return legacy-shaped rows.
 */
export async function searchParts(
  input: SearchPartsInput,
  deps: PartsAgentDependencies
): Promise<SearchPartsResult> {
  const validated = searchPartsSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  devLog('agent.searchParts', { userId, query: validated.query })

  const results = await searchPartsV2(validated, { client, userId })
  return results.map(mapPartRow)
}

/**
 * Fetch a single part, including optional markdown snapshot sections when memory v2 is enabled.
 */
export async function getPartById(
  input: GetPartByIdInput,
  deps: PartsAgentDependencies
): Promise<GetPartByIdResult> {
  const validated = getPartByIdSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  devLog('agent.getPartById', { userId, id: validated.partId })

  const part = await getPartByIdV2(validated.partId, { client, userId })
  if (!part) return null

  const mapped = mapPartRow(part)

  if (typeof window === 'undefined' && isMemoryV2Enabled()) {
    const t0 = Date.now()
    try {
      const { readPartProfileSections } = await import('@/lib/memory/read')
      const sections = await readPartProfileSections(userId, validated.partId)
      recordSnapshotUsage('part_profile', sections ? 'hit' : 'miss', { latencyMs: Date.now() - t0, userId, partId: validated.partId })
      return sections ? { ...mapped, snapshot_sections: sections } : mapped
    } catch (error) {
      recordSnapshotUsage('part_profile', 'error', { latencyMs: Date.now() - t0, userId, partId: validated.partId, error })
    }
  }

  return mapped
}

/**
 * Return a part with relationship details and optional markdown snapshots for overview, part, and relationships.
 */
export async function getPartDetail(
  input: GetPartDetailInput,
  deps: PartsAgentDependencies
): Promise<GetPartDetailResult> {
  const validated = getPartDetailSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  devLog('agent.getPartDetail', { userId, id: validated.partId })

  const part = await getPartByIdV2(validated.partId, { client, userId })
  if (!part) {
    throw new Error('Part not found')
  }

  const relationships = await listRelationshipsV2({ client, userId }, { partId: validated.partId })

  const mappedPart = mapPartRow(part)
  const mappedRelationships: PartRelationshipRow[] = relationships.map((rel) => {
    const contextPayload = parseRelationshipContext(rel.context)
    const dynamics = parseRelationshipObservations(rel.observations)
    const polarization =
      typeof contextPayload.polarizationLevel === 'number'
        ? contextPayload.polarizationLevel
        : typeof rel.strength === 'number'
          ? Math.max(0, Math.min(1, 1 - rel.strength))
          : 0.5

    return {
      id: rel.id,
      user_id: rel.user_id,
      parts: [rel.part_a_id, rel.part_b_id],
      type: fromV2RelationshipType(rel.type),
      description: contextPayload.description ?? null,
      issue: contextPayload.issue ?? null,
      common_ground: contextPayload.commonGround ?? null,
      dynamics,
      status: contextPayload.status ?? DEFAULT_RELATIONSHIP_STATUS,
      polarization_level: polarization,
      last_addressed: contextPayload.lastAddressed ?? null,
      created_at: rel.created_at,
      updated_at: rel.updated_at,
    }
  })

  let overviewSections: unknown
  let partProfileSections: unknown
  let relationshipProfiles: Record<string, unknown> | undefined

  if (typeof window === 'undefined' && isMemoryV2Enabled()) {
    const t0 = Date.now()
    try {
      const { readOverviewSections, readPartProfileSections, readRelationshipProfileSections } = await import('@/lib/memory/read')
      const rels = relationships
      const [overview, profile, relSections] = await Promise.all([
        readOverviewSections(userId),
        readPartProfileSections(userId, validated.partId),
        Promise.all(rels.map(async (rel) => readRelationshipProfileSections(userId, rel.id))),
      ])

      recordSnapshotUsage('overview', overview ? 'hit' : 'miss', { latencyMs: Date.now() - t0, userId })
      recordSnapshotUsage('part_profile', profile ? 'hit' : 'miss', { latencyMs: Date.now() - t0, userId, partId: validated.partId })

      overviewSections = overview ?? undefined
      partProfileSections = profile ?? undefined
      relationshipProfiles = relSections.reduce<Record<string, unknown>>((acc, entry, idx) => {
        if (entry) {
          acc[relationships[idx]?.id ?? String(idx)] = entry
        }
        return acc
      }, {})
    } catch (error) {
      recordSnapshotUsage('part_profile', 'error', { latencyMs: Date.now() - t0, userId, partId: validated.partId, error })
    }
  }

  return {
    ...mappedPart,
    relationships: mappedRelationships,
    snapshots:
      overviewSections || partProfileSections || relationshipProfiles
        ? {
            overview_sections: overviewSections,
            part_profile_sections: partProfileSections,
            relationship_profiles: relationshipProfiles,
          }
        : undefined,
  }
}

/**
 * Create a new emerging part in `parts_v2`, enforcing evidence count and user confirmation requirements.
 */
export async function createEmergingPart(
  input: CreateEmergingPartInput,
  deps: PartsAgentDependencies
): Promise<CreateEmergingPartResult> {
  const validated = createEmergingPartSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  if (validated.evidence.length < 3) {
    throw new Error('Cannot create emerging part: At least 3 pieces of evidence are required')
  }

  if (requiresUserConfirmation(validated.userConfirmed)) {
    throw new Error('Cannot create emerging part: User confirmation is required through chat interaction')
  }

  const nowIso = new Date().toISOString()

  const { data: existing } = await client
    .from('parts_v2')
    .select('id')
    .eq('user_id', userId)
    .eq('name', validated.name)
    .maybeSingle()

  if (existing) {
    throw new Error(`A part named "${validated.name}" already exists for this user`)
  }

  const avgEvidenceConfidence =
    validated.evidence.reduce((sum, ev) => sum + ev.confidence, 0) / validated.evidence.length
  const initialConfidence = Math.min(0.95, avgEvidenceConfidence * 0.8)

  const dataPayload: Record<string, unknown> = {
    age: validated.age ?? null,
    role: validated.role ?? null,
    triggers: validated.triggers ?? [],
    emotions: validated.emotions ?? [],
    beliefs: validated.beliefs ?? [],
    somatic_markers: validated.somaticMarkers ?? [],
    recent_evidence: validated.evidence,
    story: {
      origin: null,
      currentState: `Newly discovered part with ${validated.evidence.length} pieces of evidence`,
      purpose: validated.role ?? null,
      evolution: [
        {
          timestamp: nowIso,
          change: 'Part created',
          trigger: 'Evidence threshold reached',
        },
      ],
    },
    visualization: { ...DEFAULT_VISUALIZATION },
    acknowledged_at: null,
    last_interaction_at: nowIso,
    last_charged_at: null,
    last_charge_intensity: null,
  }

  const insertPayload = {
    user_id: userId,
    name: validated.name,
    status: 'emerging' as const,
    category: validated.category ?? 'unknown',
    confidence: initialConfidence,
    evidence_count: validated.evidence.length,
    data: dataPayload,
    first_noticed: nowIso,
    last_active: nowIso,
  }

  const actionLogger = await getActionLogger(client)
  const inserted = await actionLogger.loggedInsert(
    'parts_v2',
    insertPayload,
    userId,
    'create_emerging_part',
    {
      partName: validated.name,
      changeDescription: `Created emerging part with ${validated.evidence.length} pieces of evidence`,
      evidenceCount: validated.evidence.length,
      confidence: initialConfidence,
      category: validated.category ?? 'unknown',
    }
  )

  return mapPartRow(inserted as PartRowV2)
}

function combinePartUpdates(
  current: PartRow,
  updates: UpdatePartInput['updates'],
  nowIso: string
): { partPatch: Partial<PartRowV2>; dataPatch: Record<string, unknown>; actionType: string; changeDescription: string } {
  const partPatch: Partial<PartRowV2> = {
    last_active: nowIso,
  }

  const dataPatch: Record<string, unknown> = {}

  if (typeof updates.name === 'string' && updates.name.trim().length > 0 && updates.name !== current.name) {
    partPatch.name = updates.name.trim()
  }

  if (updates.status && updates.status !== current.status) {
    partPatch.status = updates.status
  }

  if (updates.category && updates.category !== current.category) {
    partPatch.category = updates.category
  }

  if (typeof updates.role !== 'undefined') {
    dataPatch.role = updates.role ?? null
  }

  if (typeof updates.age !== 'undefined') {
    dataPatch.age = updates.age ?? null
  }

  if (typeof updates.triggers !== 'undefined') {
    dataPatch.triggers = updates.triggers ?? []
  }

  if (typeof updates.emotions !== 'undefined') {
    dataPatch.emotions = updates.emotions ?? []
  }

  if (typeof updates.beliefs !== 'undefined') {
    dataPatch.beliefs = updates.beliefs ?? []
  }

  if (typeof updates.somaticMarkers !== 'undefined') {
    dataPatch.somatic_markers = updates.somaticMarkers ?? []
  }

  if (typeof updates.visualization !== 'undefined') {
    dataPatch.visualization = {
      ...coerceVisualization(current.visualization),
      ...updates.visualization,
    }
  }

  if (typeof updates.last_charge_intensity === 'number') {
    dataPatch.last_charge_intensity = updates.last_charge_intensity
  }

  if (typeof updates.last_charged_at === 'string') {
    dataPatch.last_charged_at = updates.last_charged_at
  }

  let actionType: string = 'update_part_attributes'
  let changeDescription = 'Updated part attributes'

  if (partPatch.name && partPatch.name !== current.name) {
    changeDescription = `renamed part from "${current.name}" to "${partPatch.name}"`
  } else if (updates.visualization) {
    changeDescription = 'updated part visualization'
  } else if (typeof updates.last_charge_intensity === 'number') {
    actionType = 'update_part_charge'
    changeDescription = `updated part charge to ${updates.last_charge_intensity.toFixed(2)}`
  } else if (updates.category && updates.category !== current.category) {
    actionType = 'update_part_category'
    changeDescription = `changed category from ${current.category} to ${updates.category}`
  }

  return { partPatch, dataPatch, actionType, changeDescription }
}

/**
 * Apply updates to a part, including confidence adjustments and evidence append, while logging the change.
 */
export async function updatePart(
  input: UpdatePartInput,
  deps: PartsAgentDependencies
): Promise<UpdatePartResult> {
  const validated = updatePartSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  const { data: currentRow, error } = await client
    .from('parts_v2')
    .select('*')
    .eq('id', validated.partId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch part_v2: ${error.message}`)
  }

  if (!currentRow) {
    throw new Error('Part not found or access denied')
  }

  const current = mapPartRow(currentRow as PartRowV2)
  const nowIso = new Date().toISOString()

  const { partPatch, dataPatch, actionType: baseActionType, changeDescription: baseChangeDescription } = combinePartUpdates(current, validated.updates, nowIso)

  let updatedConfidence = current.confidence
  if (typeof validated.updates.confidenceBoost === 'number') {
    updatedConfidence = Math.min(1, Math.max(0, updatedConfidence + validated.updates.confidenceBoost))
    partPatch.confidence = updatedConfidence
  }

  let evidenceCount = current.evidence_count
  let updatedEvidence = current.recent_evidence
  if (validated.evidence) {
    updatedEvidence = [...current.recent_evidence, validated.evidence].slice(-10)
    evidenceCount = current.evidence_count + 1
    partPatch.evidence_count = evidenceCount
    dataPatch.recent_evidence = updatedEvidence
  }
  const mergedData = buildPartDataPatch(currentRow as PartRowV2, dataPatch)

  let actionType = baseActionType
  let changeDescription = baseChangeDescription

  if (typeof validated.updates.confidenceBoost === 'number') {
    actionType = 'update_part_confidence'
    const direction = validated.updates.confidenceBoost >= 0 ? 'increased' : 'decreased'
    changeDescription = `${direction} confidence from ${current.confidence} to ${updatedConfidence}`
  } else if (validated.evidence) {
    actionType = 'add_part_evidence'
    changeDescription = `added evidence: ${validated.evidence.content.substring(0, 50)}...`
  }

  const actionLogger = await getActionLogger(client)
  const updated = await actionLogger.loggedUpdate(
    'parts_v2',
    validated.partId,
    {
      ...(partPatch as Record<string, unknown>),
      data: mergedData,
    },
    userId,
    actionType as any,
    {
      partName: current.name,
      changeDescription,
      confidenceDelta: validated.updates.confidenceBoost,
      categoryChange: validated.updates.category
        ? { from: current.category, to: validated.updates.category }
        : undefined,
      evidenceAdded: Boolean(validated.evidence),
      fieldChanged: Object.keys(validated.updates).join(', '),
      auditNote: validated.auditNote,
    }
  )

  return mapPartRow(updated as PartRowV2)
}

/**
 * List relationships for the user, remapping PRD rows into legacy structures with optional part details and snapshots.
 */
export async function getPartRelationships(
  input: GetPartRelationshipsInput,
  deps: PartsAgentDependencies
): Promise<GetPartRelationshipsResult> {
  const validated = getPartRelationshipsSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  const filterType = validated.relationshipType ? toV2RelationshipType(validated.relationshipType) : undefined

  const relationships = await listRelationshipsV2(
    { client, userId },
    {
      partId: validated.partId,
      type: filterType,
    }
  )

  const filtered = validated.partId
    ? relationships.filter(
        (rel) => rel.part_a_id === validated.partId || rel.part_b_id === validated.partId
      )
    : relationships

  const limited = filtered.slice(0, validated.limit)

  let partsDetails: Record<string, { name: string; status: string }> = {}
  if (validated.includePartDetails) {
    const ids = new Set<string>()
    for (const rel of limited) {
      ids.add(rel.part_a_id)
      ids.add(rel.part_b_id)
    }
    if (ids.size > 0) {
      const { data, error } = await client
        .from('parts_v2')
        .select('id, name, status')
        .eq('user_id', userId)
        .in('id', Array.from(ids))
      if (error) {
        throw new Error(`Error fetching part details: ${error.message}`)
      }
      partsDetails = (data ?? []).reduce<Record<string, { name: string; status: string }>>((acc, part) => {
        acc[part.id] = { name: part.name ?? 'Unnamed Part', status: part.status ?? 'active' }
        return acc
      }, {})
    }
  }

  let snapshotSections: Array<unknown> | undefined
  if (typeof window === 'undefined' && isMemoryV2Enabled()) {
    try {
      const { readRelationshipProfileSections } = await import('@/lib/memory/read')
      snapshotSections = await Promise.all(
        limited.map((rel) => readRelationshipProfileSections(userId, rel.id).catch(() => null))
      )
    } catch {
      snapshotSections = undefined
    }
  }

  return limited.map((rel, idx) => {
    const contextPayload = parseRelationshipContext(rel.context)
    const dynamics = parseRelationshipObservations(rel.observations)
    const polarization =
      typeof contextPayload.polarizationLevel === 'number'
        ? contextPayload.polarizationLevel
        : typeof rel.strength === 'number'
          ? Math.max(0, Math.min(1, 1 - rel.strength))
          : 0.5

    const partIds = [rel.part_a_id, rel.part_b_id]

    return {
      id: rel.id,
      type: fromV2RelationshipType(rel.type),
      status: contextPayload.status ?? DEFAULT_RELATIONSHIP_STATUS,
      description: contextPayload.description ?? null,
      issue: contextPayload.issue ?? null,
      common_ground: contextPayload.commonGround ?? null,
      polarization_level: polarization,
      dynamics,
      parts: partIds.map((partId) => ({
        id: partId,
        ...(validated.includePartDetails && partsDetails[partId]
          ? { name: partsDetails[partId].name, status: partsDetails[partId].status }
          : {}),
      })),
      last_addressed: contextPayload.lastAddressed ?? null,
      created_at: rel.created_at,
      updated_at: rel.updated_at,
      ...(snapshotSections && snapshotSections[idx] ? { snapshot_sections: snapshotSections[idx] } : {}),
    }
  })
}

/**
 * Fetch freeform clarification notes for a part, ensuring user scoping through Supabase joins.
 */
export async function getPartNotes(
  input: GetPartNotesInput,
  deps: PartsAgentDependencies
): Promise<GetPartNotesResult> {
  const validated = getPartNotesSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  const { data, error } = await client
    .from('part_notes')
    .select('id, part_id, content, created_at, parts!inner(user_id)')
    .eq('part_id', validated.partId)
    .eq('parts.user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  return (data ?? []).map((note: any) => ({
    id: note.id,
    part_id: note.part_id,
    content: note.content,
    created_at: note.created_at,
  })) as PartNoteRow[]
}

/**
 * Create or update a relationship record, computing polarization strength and persisting audit logs.
 */
export async function logRelationship(
  input: LogRelationshipInput,
  deps: PartsAgentDependencies
): Promise<LogRelationshipResult> {
  const validated = logRelationshipSchema.parse(input)
  const { client, userId } = assertAgentDeps(deps)

  const sortedPartIds = [...validated.partIds].sort()
  const nowIso = new Date().toISOString()
  const v2Type = toV2RelationshipType(validated.type)

  const contextPayload: RelationshipContextPayload = {
    description: validated.description ?? null,
    issue: validated.issue ?? null,
    commonGround: validated.commonGround ?? null,
    status: validated.status ?? DEFAULT_RELATIONSHIP_STATUS,
    polarizationLevel:
      typeof validated.polarizationLevel === 'number' ? validated.polarizationLevel : undefined,
    lastAddressed: validated.lastAddressed ?? null,
  }

  const dynamics: RelationshipDynamic[] = validated.dynamic
    ? [
        {
          observation: validated.dynamic.observation,
          context: validated.dynamic.context,
          polarizationChange: validated.dynamic.polarizationChange,
          timestamp: validated.dynamic.timestamp ?? nowIso,
        },
      ]
    : []

  const { data: candidates, error } = await client
    .from('part_relationships_v2')
    .select('*')
    .eq('user_id', userId)
    .eq('type', v2Type)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(`Failed to query relationships: ${error.message}`)
  }

  const matched = (candidates ?? []).find((row) => {
    const pair = [row.part_a_id, row.part_b_id].sort()
    return pair[0] === sortedPartIds[0] && pair[1] === sortedPartIds[1]
  })

  const polarization =
    typeof contextPayload.polarizationLevel === 'number'
      ? Math.max(0, Math.min(1, contextPayload.polarizationLevel))
      : typeof validated.polarizationLevel === 'number'
        ? Math.max(0, Math.min(1, validated.polarizationLevel))
        : 0.5

  const strength = 1 - polarization

  if (matched) {
    const currentContext = parseRelationshipContext(matched.context)
    const currentDynamics = parseRelationshipObservations(matched.observations)

    const nextContext: RelationshipContextPayload = {
      description: contextPayload.description ?? currentContext.description ?? null,
      issue: contextPayload.issue ?? currentContext.issue ?? null,
      commonGround: contextPayload.commonGround ?? currentContext.commonGround ?? null,
      status: contextPayload.status ?? currentContext.status ?? DEFAULT_RELATIONSHIP_STATUS,
      polarizationLevel: polarization,
      lastAddressed: contextPayload.lastAddressed ?? currentContext.lastAddressed ?? null,
    }

    const nextDynamics = [...currentDynamics, ...dynamics]

    const updatePayload = {
      strength,
      context: encodeRelationshipContext(nextContext),
      observations: encodeRelationshipDynamics(nextDynamics),
      updated_at: nowIso,
    }

    const serviceRole = getSupabaseServiceRoleKey()
    if (typeof window === 'undefined' && dev.enabled && serviceRole) {
      const { data: direct, error: updateError } = await client
        .from('part_relationships_v2')
        .update(updatePayload as any)
        .eq('id', matched.id)
        .eq('user_id', userId)
        .select('*')
        .single()
      if (updateError || !direct) {
        throw new Error(`Failed to update relationship: ${updateError?.message ?? 'unknown error'}`)
      }
      return mapRelationshipRowLegacy(
        direct as PartRelationshipRowV2,
        nextContext,
        nextDynamics,
        polarization,
        sortedPartIds
      )
    }

    const actionLogger = await getActionLogger(client)
    const updated = await actionLogger.loggedUpdate(
      'part_relationships_v2',
      matched.id,
      updatePayload as any,
      userId,
      'update_relationship',
      {
        partIds: sortedPartIds,
        changeDescription: dynamics.length
          ? `Appended dynamic: ${dynamics[0].observation.substring(0, 60)}...`
          : 'Updated relationship fields',
        polarization,
        type: validated.type,
      }
    )

    return mapRelationshipRowLegacy(updated as PartRelationshipRowV2, nextContext, nextDynamics, polarization, sortedPartIds)
  }

  const insertContext: RelationshipContextPayload = {
    ...contextPayload,
    polarizationLevel: polarization,
  }

  const insertPayload = {
    part_a_id: sortedPartIds[0],
    part_b_id: sortedPartIds[1],
    type: v2Type,
    strength,
    context: encodeRelationshipContext(insertContext),
    observations: encodeRelationshipDynamics(dynamics),
    created_at: nowIso,
    updated_at: nowIso,
  }

  const actionLogger = await getActionLogger(client)
  const created = await actionLogger.loggedInsert(
    'part_relationships_v2',
    insertPayload as any,
    userId,
    'create_relationship',
    {
      partIds: sortedPartIds,
      changeDescription: dynamics.length
        ? `Created relationship with dynamic: ${dynamics[0].observation.substring(0, 60)}...`
        : 'Created relationship',
      polarization,
      type: validated.type,
    }
  )

  return mapRelationshipRowLegacy(created as PartRelationshipRowV2, insertContext, dynamics, polarization, sortedPartIds)
}

export const __test = {
  mapPartRow,
  parseRelationshipContext,
  encodeRelationshipContext,
  parseRelationshipObservations,
  encodeRelationshipDynamics,
  toV2RelationshipType,
  fromV2RelationshipType,
}
