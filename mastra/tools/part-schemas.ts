import { z } from 'zod'

export const searchPartsSchema = z.object({
  query: z.string().optional().describe('Search query for part names or roles'),
  status: z
    .enum(['emerging', 'acknowledged', 'active', 'integrated'])
    .optional()
    .describe('Filter by part status'),
  category: z
    .enum(['manager', 'firefighter', 'exile', 'unknown'])
    .optional()
    .describe('Filter by part category'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum number of results to return'),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID for the search (optional in development mode)'),
})

export const getPartByIdSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve'),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID who owns the part (optional in development mode)'),
})

export const getPartDetailSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to retrieve details for'),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID who owns the part (optional in development mode)'),
})

export const createEmergingPartSchema = z.object({
  name: z.string().min(1).max(100).describe('Name of the emerging part'),
  evidence: z
    .array(
      z.object({
        type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
        content: z.string(),
        confidence: z.number().min(0).max(1),
        sessionId: z.string().uuid(),
        timestamp: z.string().datetime(),
      })
    )
    .min(3)
    .describe('Evidence supporting the part (minimum 3 required)'),
  category: z
    .enum(['manager', 'firefighter', 'exile', 'unknown'])
    .optional()
    .default('unknown'),
  age: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Perceived age of the part'),
  role: z.string().optional().describe('Role or function of the part'),
  triggers: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Known triggers for this part'),
  emotions: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Emotions associated with this part'),
  beliefs: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Beliefs held by this part'),
  somaticMarkers: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Physical sensations associated with this part'),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID who owns the part (optional in development mode)'),
  userConfirmed: z
    .boolean()
    .describe('Whether the user has confirmed this part exists through chat interaction'),
})

export const updatePartSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to update'),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID who owns the part (optional in development mode)'),
  updates: z
    .object({
      name: z.string().min(1).max(100).optional(),
      status: z
        .enum(['emerging', 'acknowledged', 'active', 'integrated'])
        .optional(),
      category: z
        .enum(['manager', 'firefighter', 'exile', 'unknown'])
        .optional(),
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
  evidence: z
    .object({
      type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
      content: z.string(),
      confidence: z.number().min(0).max(1),
      sessionId: z.string().uuid(),
      timestamp: z.string().datetime(),
    })
    .optional()
    .describe('New evidence to add for this update'),
  auditNote: z
    .string()
    .optional()
    .describe('Note about why this update was made'),
})

export const getPartRelationshipsSchema = z.object({
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID to get relationships for (optional in development mode)'),
  partId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional: Get relationships for specific part'),
  relationshipType: z
    .enum(['polarized', 'protector-exile', 'allied'])
    .optional()
    .describe('Optional: Filter by relationship type'),
  status: z
    .enum(['active', 'healing', 'resolved'])
    .optional()
    .describe('Optional: Filter by relationship status'),
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

export const logRelationshipSchema = z.object({
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID who owns the relationship (optional in development mode)'),
  partIds: z
    .array(z.string().uuid())
    .min(2)
    .max(2)
    .describe('Exactly two part IDs involved in the relationship'),
  type: z
    .enum(['polarized', 'protector-exile', 'allied'])
    .describe('Relationship type'),
  description: z.string().optional().describe('Short description of the relationship'),
  issue: z.string().optional().describe('Primary point of conflict or issue'),
  commonGround: z
    .string()
    .optional()
    .describe('Areas of agreement or shared goals'),
  status: z
    .enum(['active', 'healing', 'resolved'])
    .optional()
    .describe('Relationship status'),
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
  upsert: z
    .boolean()
    .default(true)
    .describe('Update existing relationship if it exists; otherwise create'),
})

