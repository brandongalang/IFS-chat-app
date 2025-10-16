import type { PartRow, PartEvidence, RelationshipDynamic, RelationshipStatus, RelationshipType, Json } from '@/lib/types/database'
import type { PartRowV2 } from './types'

export const DEFAULT_STORY: PartRow['story'] = {
  origin: null,
  currentState: null,
  purpose: null,
  evolution: [],
}

export const DEFAULT_VISUALIZATION: PartRow['visualization'] = {
  emoji: '🤗',
  color: '#6B7280',
  energyLevel: 0.5,
}

export const DEFAULT_RELATIONSHIP_STATUS: RelationshipStatus = 'active'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const coerceArray = <T>(value: unknown, fallback: readonly T[] = []): T[] => {
  if (Array.isArray(value)) return value as T[]
  return [...fallback]
}

const coerceStory = (value: unknown): PartRow['story'] => {
  if (!isPlainObject(value)) {
    return { ...DEFAULT_STORY }
  }
  const story = value as Partial<PartRow['story']>
  return {
    origin: typeof story.origin === 'string' ? story.origin : null,
    currentState: typeof story.currentState === 'string' ? story.currentState : null,
    purpose: typeof story.purpose === 'string' ? story.purpose : null,
    evolution: Array.isArray(story.evolution)
      ? story.evolution.filter((entry): entry is PartRow['story']['evolution'][number] =>
          isPlainObject(entry) &&
          typeof entry.timestamp === 'string' &&
          typeof entry.change === 'string'
        )
      : [],
  }
}

export const coerceVisualization = (value: unknown): PartRow['visualization'] => {
  if (!isPlainObject(value)) {
    return { ...DEFAULT_VISUALIZATION }
  }
  const vis = value as Partial<PartRow['visualization']>
  return {
    emoji: typeof vis.emoji === 'string' && vis.emoji.length > 0 ? vis.emoji : DEFAULT_VISUALIZATION.emoji,
    color: typeof vis.color === 'string' && vis.color.length > 0 ? vis.color : DEFAULT_VISUALIZATION.color,
    energyLevel:
      typeof vis.energyLevel === 'number' && Number.isFinite(vis.energyLevel)
        ? Math.max(0, Math.min(1, vis.energyLevel))
        : DEFAULT_VISUALIZATION.energyLevel,
  }
}

export function mapPartRowFromV2(row: PartRowV2): PartRow {
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

export interface RelationshipContextPayload {
  description?: string | null
  issue?: string | null
  commonGround?: string | null
  status?: RelationshipStatus | null
  polarizationLevel?: number | null
  lastAddressed?: string | null
}

export function parseRelationshipContext(raw: unknown): RelationshipContextPayload {
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

export function parseRelationshipObservations(raw: unknown): RelationshipDynamic[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const results: RelationshipDynamic[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      try {
        const parsed = JSON.parse(entry) as { dynamics?: RelationshipDynamic[] } | RelationshipDynamic
        if (Array.isArray((parsed as { dynamics?: RelationshipDynamic[] }).dynamics)) {
          results.push(...((parsed as { dynamics?: RelationshipDynamic[] }).dynamics ?? []))
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

export type RelationshipTypeV2 = 'protects' | 'conflicts' | 'supports' | 'triggers' | 'soothes'

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

export function toV2RelationshipType(type: RelationshipType): RelationshipTypeV2 {
  return RELATIONSHIP_TYPE_TO_V2[type] ?? 'supports'
}

export function fromV2RelationshipType(type: string | null | undefined): RelationshipType {
  if (!type) return 'allied'
  const cast = type as RelationshipTypeV2
  return RELATIONSHIP_TYPE_FROM_V2[cast] ?? 'allied'
}
