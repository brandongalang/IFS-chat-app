import { z } from 'zod';
import type { InboxEnvelopeBase } from '@/app/_shared/types/inbox';
import {
  type PartRowV2,
  partCategoryEnum,
  partStatusEnum,
  type PartRelationshipRowV2,
  relationshipTypeEnum,
  type ObservationRow,
  partChargeEnum,
} from '../schema/types';

export {
  type PartRowV2,
  partCategoryEnum,
  partStatusEnum,
  type PartRelationshipRowV2,
  relationshipTypeEnum,
  type ObservationRow,
  partChargeEnum,
};
export const DEFAULT_RELATIONSHIP_STATUS = 'active';
export const DEFAULT_VISUALIZATION = {
  emoji: '👤',
  color: '#6B7280',
};

export type RelationshipContextPayload = {
  description?: string | null;
  issue?: string | null;
  commonGround?: string | null;
  status?: string | null;
  polarizationLevel?: number | null;
  lastAddressed?: string | null;
};

export function coerceVisualization(v: unknown): { emoji: string; color: string } {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const vo = v as Record<string, unknown>;
    return {
      emoji: typeof vo.emoji === 'string' ? vo.emoji : DEFAULT_VISUALIZATION.emoji,
      color: typeof vo.color === 'string' ? vo.color : DEFAULT_VISUALIZATION.color,
    };
  }
  return DEFAULT_VISUALIZATION;
}

export function parseRelationshipContext(raw: string | null): RelationshipContextPayload {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return {
      description: parsed.description ?? null,
      issue: parsed.issue ?? null,
      commonGround: parsed.commonGround ?? null,
      status: parsed.status ?? null,
      polarizationLevel: parsed.polarizationLevel ?? null,
      lastAddressed: parsed.lastAddressed ?? null,
    };
  } catch {
    return { description: raw };
  }
}

export function parseRelationshipObservations(obs: string[] | null): string[] {
  if (!obs || !Array.isArray(obs)) return [];
  return obs.map((o) => {
    if (typeof o === 'string' && (o.startsWith('{') || o.startsWith('['))) {
      try {
        const p = JSON.parse(o);
        return p.observation || p.content || o;
      } catch {
        return o;
      }
    }
    return o;
  });
}

// Internal helpers
const evidenceSchema = z
  .object({
    type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    sessionId: z.string().uuid(),
    timestamp: z.string().datetime(),
  })
  .strict();

const relationshipDynamicSchema = z
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
  .strict();

export type RelationshipDynamic = z.infer<typeof relationshipDynamicSchema>;

// Relationship status enum used for filtering and display
export const relationshipStatusEnum = z.enum(['active', 'healing', 'resolved', 'conflicted']);
export type RelationshipStatus = z.infer<typeof relationshipStatusEnum>;

export interface FollowUpMessage {
  title: string;
  summary: string;
  body: string;
  inference?: string;
}

export type FollowUpEnvelope = InboxEnvelopeBase & {
  type: 'follow_up';
  payload: FollowUpMessage;
};

// UpsertRelationshipInput from schema/relationships.ts
export const upsertRelationshipInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    part_a_id: z.string().uuid(),
    part_b_id: z.string().uuid(),
    type: relationshipTypeEnum,
    strength: z.number().min(0).max(1).optional(),
    context: z.string().nullable().optional(),
    observations: z.array(z.string()).optional(),
  })
  .strict();

export type UpsertRelationshipInput = z.infer<typeof upsertRelationshipInputSchema>;
export type RelationshipType =
  | z.infer<typeof relationshipTypeEnum>
  | 'polarized'
  | 'protector-exile'
  | 'allied';

export const searchPartsSchema = z
  .object({
    query: z.string().optional().describe('Search query for part names or roles'),
    status: partStatusEnum.optional().describe('Filter by part status'),
    category: partCategoryEnum.optional().describe('Filter by part category'),
    limit: z.number().min(1).max(50).default(20).describe('Maximum number of results to return'),
  })
  .strict();

// SearchPartsInput from schema/parts.ts
export const searchPartsInputSchema = z
  .object({
    query: z.string().optional(),
    category: partCategoryEnum.optional(),
    status: partStatusEnum.optional(),
    needsAttention: z.boolean().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export type SearchPartsInput = z.infer<typeof searchPartsInputSchema>;
export type SearchPartsResult = PartRowV2[];

// UpsertPartInput from schema/parts.ts
export const upsertPartInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().optional(),
    placeholder: z.string().optional(),
    category: partCategoryEnum.optional(),
    status: partStatusEnum.optional(),
    charge: partChargeEnum.optional(),
    data: z.record(z.any()).optional(),
    needs_attention: z.boolean().optional(),
    confidence: z.number().optional(),
    evidence_count: z.number().optional(),
    first_noticed: z.string().optional(),
    last_active: z.string().optional(),
  })
  .strict();

export type UpsertPartInput = z.infer<typeof upsertPartInputSchema>;

export const getPartByIdSchema = z
  .object({
    partId: z.string().uuid().describe('The UUID of the part to retrieve'),
  })
  .strict();

export type GetPartByIdInput = z.infer<typeof getPartByIdSchema>;
export type PartWithSnapshots = PartRowV2 & { snapshot_sections?: unknown };
export type GetPartByIdResult = PartWithSnapshots | null;

export const getPartDetailSchema = z
  .object({
    partId: z.string().uuid().describe('The UUID of the part to retrieve details for'),
  })
  .strict();

export type GetPartDetailInput = z.infer<typeof getPartDetailSchema>;
export interface PartDetailSnapshots {
  overview_sections?: unknown;
  part_profile_sections?: unknown;
  relationship_profiles?: Record<string, unknown>;
}
export type GetPartDetailResult = PartRowV2 & {
  relationships: PartRelationshipRowV2[];
  snapshots?: PartDetailSnapshots;
};

export const createEmergingPartSchema = z
  .object({
    name: z.string().min(1).max(100).describe('Name of the emerging part'),
    evidence: z
      .array(evidenceSchema)
      .min(3)
      .describe('Evidence supporting the part (minimum 3 required)'),
    category: partCategoryEnum.optional().default('unknown'),
    age: z.number().min(0).max(100).optional().describe('Perceived age of the part'),
    role: z.string().optional().describe('Role or function of the part'),
    triggers: z.array(z.string()).optional().default([]).describe('Known triggers for this part'),
    emotions: z
      .array(z.string())
      .optional()
      .default([])
      .describe('Emotions associated with this part'),
    beliefs: z.array(z.string()).optional().default([]).describe('Beliefs held by this part'),
    somaticMarkers: z
      .array(z.string())
      .optional()
      .default([])
      .describe('Physical sensations associated with this part'),
    userConfirmed: z
      .boolean()
      .describe('Whether the user has confirmed this part exists through chat interaction'),
  })
  .strict();

export type CreateEmergingPartInput = z.infer<typeof createEmergingPartSchema>;
export type CreateEmergingPartResult = PartRowV2;

export const updatePartSchema = z
  .object({
    partId: z.string().uuid().describe('The UUID of the part to update'),
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
        acknowledged_at: z
          .string()
          .datetime()
          .optional()
          .describe('When the part was acknowledged'),
        last_interaction_at: z
          .string()
          .datetime()
          .optional()
          .describe('When the part was last interacted with'),
        last_active: z.string().datetime().optional().describe('When the part was last active'),
      })
      .describe('Fields to update'),
    evidence: evidenceSchema.optional().describe('New evidence to add for this update'),
    auditNote: z.string().optional().describe('Note about why this update was made'),
  })
  .strict();

export type UpdatePartInput = z.infer<typeof updatePartSchema>;
export type UpdatePartResult = PartRowV2;

export const getPartRelationshipsSchema = z
  .object({
    partId: z.string().uuid().optional().describe('Optional: Get relationships for specific part'),
    relationshipType: relationshipTypeEnum
      .optional()
      .describe('Optional: Filter by relationship type'),
    status: relationshipStatusEnum.optional().describe('Optional: Filter by relationship status'),
    includePartDetails: z
      .boolean()
      .default(false)
      .describe('Include part names and status in response'),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(20)
      .describe('Maximum number of relationships to return'),
  })
  .strict();

export type GetPartRelationshipsInput = z.infer<typeof getPartRelationshipsSchema>;
export interface PartRelationshipParticipant {
  id: string;
  name: string;
  visualization?: {
    emoji: string;
    color: string;
  };
}
// Note: Using V2 relationship type directly
export interface PartRelationshipWithDetails {
  id: string;
  user_id: string;
  part_a_id: string;
  part_b_id: string;
  type: RelationshipType;
  strength: number;
  context: RelationshipContextPayload | null;
  common_ground?: string | null;
  polarization_level?: number | null;
  dynamics: RelationshipDynamic[];
  parts: PartRelationshipParticipant[];
  last_addressed?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  snapshot_sections?: unknown;
}
export type GetPartRelationshipsResult = PartRelationshipWithDetails[];

export const getPartNotesSchema = z
  .object({
    partId: z.string().uuid().describe('The UUID of the part to retrieve notes for'),
  })
  .strict();

export type GetPartNotesInput = z.infer<typeof getPartNotesSchema>;
// Note: PartNoteRowV2 is the local V2-aligned type
export interface PartNoteRowV2 {
  id: string;
  part_id: string;
  content: string;
  created_at: string;
}
export type GetPartNotesResult = PartNoteRowV2[];

export type LogRelationshipResult = PartRelationshipRowV2;

export const logRelationshipSchema = z
  .object({
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
  .strict();

export type LogRelationshipInput = z.infer<typeof logRelationshipSchema>;

export const supersedePartSchema = z
  .object({
    partId: z.string().uuid().describe('The UUID of the part being superseded'),
    supersededBy: z
      .array(z.string().uuid())
      .min(1)
      .describe('List of part IDs that supersede this part'),
    reason: z.string().optional().describe('Reason for superseding (e.g., "split", "merge")'),
  })
  .strict();

export type SupersedePartInput = z.infer<typeof supersedePartSchema>;
export type SupersedePartResult = PartRowV2;
