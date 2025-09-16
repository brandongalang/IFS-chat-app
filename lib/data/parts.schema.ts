import { z } from 'zod'
import type {
  PartNoteRow,
  PartRelationshipRow,
  PartRow,
  RelationshipDynamic,
  RelationshipStatus,
  RelationshipType,
} from '@/lib/types/database'

export const partStatusEnum = z.enum(['emerging', 'acknowledged', 'active', 'integrated'])
export const partCategoryEnum = z.enum(['manager', 'firefighter', 'exile', 'unknown'])
export const relationshipTypeEnum = z.enum(['polarized', 'protector-exile', 'allied'])
export const relationshipStatusEnum = z.enum(['active', 'healing', 'resolved'])

const evidenceSchema = z.object({
  type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  sessionId: z.string().uuid(),
  timestamp: z.string().datetime(),
})

const relationshipDynamicSchema = z.object({
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

export const searchPartsSchema = z.object({
  query: z.string().optional().describe('Search query for part names or roles'),
  status: partStatusEnum.optional().describe('Filter by part status'),
  category: partCategoryEnum.optional().describe('Filter by part category'),
  limit: z.number().min(1).max(50).default(20).describe('Maximum number of results to return'),
  userId: z.string().uuid().optional().describe('User ID for the search (optional in development mode)'),
})

export const getPartByIdSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
})

export const getPartDetailSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve details for'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
})

export const createEmergingPartSchema = z.object({
  name: z.string().min(1).max(100).describe('Name of the emerging part'),
  evidence: z.array(evidenceSchema).min(3).describe('Evidence supporting the part (minimum 3 required)'),
  category: partCategoryEnum.optional().default('unknown'),
  age: z.number().min(0).max(100).optional().describe('Perceived age of the part'),
  role: z.string().optional().describe('Role or function of the part'),
  triggers: z.array(z.string()).optional().default([]).describe('Known triggers for this part'),
  emotions: z.array(z.string()).optional().default([]).describe('Emotions associated with this part'),
  beliefs: z.array(z.string()).optional().default([]).describe('Beliefs held by this part'),
  somaticMarkers: z.array(z.string()).optional().default([]).describe('Physical sensations associated with this part'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
  userConfirmed: z
    .boolean()
    .describe('Whether the user has confirmed this part exists through chat interaction'),
})

export const updatePartSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to update'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
  updates: z
    .object({
      name: z.string().min(1).max(100).optional(),
      status: partStatusEnum.optional(),
      category: partCategoryEnum.optional(),
      age: z.number().min(0).max(100).optional(),
      role: z.string().optional(),
      triggers: z.array(z.string()).optional(),
      emotions: z.array(z.string()).optional(),
      beliefs: z.array(z.string()).optional(),
      somaticMarkers: z.array(z.string()).optional(),
      visualization: z
        .object({
          emoji: z.string(),
          color: z.string(),
        })
        .optional(),
      confidenceBoost: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Amount to adjust identification confidence by (explicit only)'),
      last_charged_at: z
        .string()
        .datetime()
        .optional()
        .describe("Timestamp for when the part's charge was last updated"),
      last_charge_intensity: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Intensity of the part's last charge (0 to 1)"),
    })
    .describe('Fields to update'),
  evidence: evidenceSchema.optional().describe('New evidence to add for this update'),
  auditNote: z.string().optional().describe('Note about why this update was made'),
})

export const getPartRelationshipsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID to get relationships for (optional in development mode)'),
  partId: z.string().uuid().optional().describe('Optional: Get relationships for specific part'),
  relationshipType: relationshipTypeEnum.optional().describe('Optional: Filter by relationship type'),
  status: relationshipStatusEnum.optional().describe('Optional: Filter by relationship status'),
  includePartDetails: z.boolean().default(false).describe('Include part names and status in response'),
  limit: z.number().min(1).max(50).default(20).describe('Maximum number of relationships to return'),
})

export const getPartNotesSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve notes for'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
})

export const logRelationshipSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID who owns the relationship (optional in development mode)'),
  partIds: z
    .array(z.string().uuid())
    .min(2)
    .max(2)
    .describe('Exactly two part IDs involved in the relationship'),
  type: relationshipTypeEnum.describe('Relationship type'),
  description: z.string().optional().describe('Short description of the relationship'),
  issue: z.string().optional().describe('Primary point of conflict or issue'),
  commonGround: z.string().optional().describe('Areas of agreement or shared goals'),
  status: relationshipStatusEnum.optional().describe('Relationship status'),
  polarizationLevel: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Absolute polarization level to set (0..1)'),
  dynamic: relationshipDynamicSchema.optional(),
  lastAddressed: z
    .string()
    .datetime()
    .optional()
    .describe('When this relationship was last addressed'),
  upsert: z
    .boolean()
    .default(true)
    .describe('Update existing relationship if it exists; otherwise create'),
})

export type SearchPartsInput = z.infer<typeof searchPartsSchema>
export type SearchPartsResult = PartRow[]

export type GetPartByIdInput = z.infer<typeof getPartByIdSchema>
export type PartWithSnapshots = PartRow & { snapshot_sections?: unknown }
export type GetPartByIdResult = PartWithSnapshots | null

export type GetPartDetailInput = z.infer<typeof getPartDetailSchema>
export interface PartDetailSnapshots {
  overview_sections?: unknown
  part_profile_sections?: unknown
  relationship_profiles?: Record<string, unknown>
}
export type GetPartDetailResult = Omit<PartRow, 'relationships'> & {
  relationships: PartRelationshipRow[]
  snapshots?: PartDetailSnapshots
}

export type CreateEmergingPartInput = z.infer<typeof createEmergingPartSchema>
export type CreateEmergingPartResult = PartRow

export type UpdatePartInput = z.infer<typeof updatePartSchema>
export type UpdatePartResult = PartRow

export type GetPartRelationshipsInput = z.infer<typeof getPartRelationshipsSchema>
export interface PartRelationshipParticipant {
  id: string
  name?: string
  status?: string
}
export interface PartRelationshipWithDetails {
  id: string
  type: RelationshipType
  status: RelationshipStatus
  description?: string | null
  issue?: string | null
  common_ground?: string | null
  polarization_level?: number | null
  dynamics: RelationshipDynamic[]
  parts: PartRelationshipParticipant[]
  last_addressed?: string | null
  created_at?: string | null
  updated_at?: string | null
  snapshot_sections?: unknown
}
export type GetPartRelationshipsResult = PartRelationshipWithDetails[]

export type GetPartNotesInput = z.infer<typeof getPartNotesSchema>
export type GetPartNotesResult = PartNoteRow[]

export type LogRelationshipInput = z.infer<typeof logRelationshipSchema>
export type LogRelationshipResult = PartRelationshipRow
