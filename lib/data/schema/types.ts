import { z } from 'zod'

export const partCategoryEnum = z.enum(['manager', 'firefighter', 'exile', 'unknown'])
export const partStatusEnum = z.enum(['emerging', 'acknowledged', 'active', 'integrated'])
export const partChargeEnum = z.enum(['positive', 'negative', 'neutral'])

export const observationTypeEnum = z.enum([
  'part_behavior',
  'resistance',
  'breakthrough',
  'somatic',
  'pattern',
  'note',
])

export const relationshipTypeEnum = z.enum(['protects', 'conflicts', 'supports', 'triggers', 'soothes'])

export const sessionTypeEnum = z.enum(['therapy', 'check_in', 'exploration'])

export const partRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    name: z.string().nullable(),
    placeholder: z.string().nullable(),
    category: partCategoryEnum.default('unknown'),
    status: partStatusEnum.default('emerging'),
    charge: partChargeEnum.default('neutral'),
    data: z.record(z.any()).default({}),
    needs_attention: z.boolean().default(false),
    confidence: z.number().min(0).max(1).default(0),
    evidence_count: z.number().int().nonnegative().default(0),
    first_noticed: z.string().datetime(),
    last_active: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    // Generated column in DB; present in SELECT * but not used by app logic
    search_vector: z.any().optional(),
  })
  .strict()

export type PartRowV2 = z.infer<typeof partRowSchema>

function toIsoString(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    let raw = value.trim()
    if (raw.length === 0) return null

    // Convert common Postgres formats like "2025-10-18 12:34:56.789+00"
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(raw)) {
      raw = raw.replace(' ', 'T')
    }

    // Normalise timezone offsets lacking colon or containing leading spaces, e.g. "+00", "+0000", " +00"
    raw = raw.replace(/\s*([+-])(\d{2})(?::?(\d{2}))?$/, (
      _match: string,
      sign: string,
      hours: string,
      minutes?: string,
    ) => {
      const mins = minutes ?? '00'
      return `${sign}${hours}:${mins}`
    })

    // If the string has no timezone, assume UTC
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
      raw = `${raw}Z`
    }

    const date = new Date(raw)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }

    return raw
  }
  return null
}

export function normalizePartRowDates(row: any): any {
  if (!row || typeof row !== 'object') return row
  const copy: any = { ...row }
  if ('first_noticed' in copy && copy.first_noticed != null) copy.first_noticed = toIsoString(copy.first_noticed) ?? copy.first_noticed
  if ('last_active' in copy && copy.last_active != null) copy.last_active = toIsoString(copy.last_active) ?? copy.last_active
  if ('created_at' in copy) copy.created_at = toIsoString(copy.created_at) ?? copy.created_at
  if ('updated_at' in copy) copy.updated_at = toIsoString(copy.updated_at) ?? copy.updated_at
  return copy
}

export const sessionRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    type: sessionTypeEnum.default('therapy'),
    observations: z.array(z.string().uuid()),
    parts_present: z.array(z.string().uuid()),
    summary: z.string().nullable(),
    key_insights: z.array(z.string()),
    breakthroughs: z.array(z.string()),
    resistance_notes: z.array(z.string()),
    homework: z.array(z.string()),
    next_session: z.array(z.string()),
    metadata: z.record(z.any()),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime().nullable(),
    last_message_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict()

export type SessionRowV2 = z.infer<typeof sessionRowSchema>

export const observationRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    session_id: z.string().uuid().nullable(),
    type: observationTypeEnum,
    content: z.string(),
    metadata: z.record(z.any()),
    entities: z.array(z.string().uuid()),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    // Generated column present in SELECT *
    search_vector: z.any().optional(),
  })
  .strict()

export type ObservationRow = z.infer<typeof observationRowSchema>

export const partRelationshipRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    part_a_id: z.string().uuid(),
    part_b_id: z.string().uuid(),
    type: relationshipTypeEnum,
    strength: z.number().min(0).max(1).default(0.5),
    context: z.string().nullable(),
    observations: z.array(z.string()),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict()

export type PartRelationshipRowV2 = z.infer<typeof partRelationshipRowSchema>

export const timelineEventRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    session_id: z.string().uuid().nullable(),
    type: z.enum(['part_emerged', 'breakthrough', 'integration', 'relationship_discovered']),
    description: z.string().nullable(),
    entities: z.array(z.string().uuid()),
    metadata: z.record(z.any()),
    created_at: z.string().datetime(),
  })
  .strict()

export type TimelineEventRow = z.infer<typeof timelineEventRowSchema>
