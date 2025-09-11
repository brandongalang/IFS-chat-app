import { createTool } from '@mastra/core'
import {
  searchParts,
  getPartById,
  getPartDetail,
  createEmergingPart,
  updatePart,
  getPartRelationships,
  logRelationship,
} from '@/lib/data/parts-server'
import {
  // reuse schemas from part-tools via type inference
} from './part-tools'
import { z } from 'zod'

// Re-declare schemas with zod to satisfy createTool inputs without importing @mastra/core in client modules.
// These must match the shapes in part-tools.ts
const searchPartsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['emerging', 'acknowledged', 'active', 'integrated']).optional(),
  category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
  limit: z.number().min(1).max(50).default(20),
})

const getPartByIdSchema = z.object({
  partId: z.string().uuid(),
})

const getPartDetailSchema = z.object({
  partId: z.string().uuid(),
})

const createEmergingPartSchema = z.object({
  name: z.string().min(1).max(100),
  evidence: z.array(z.object({
    type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    sessionId: z.string().uuid(),
    timestamp: z.string().datetime()
  })).min(3),
  category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional().default('unknown'),
  age: z.number().min(0).max(100).optional(),
  role: z.string().optional(),
  triggers: z.array(z.string()).optional().default([]),
  emotions: z.array(z.string()).optional().default([]),
  beliefs: z.array(z.string()).optional().default([]),
  somaticMarkers: z.array(z.string()).optional().default([]),
  userConfirmed: z.boolean(),
})

const updatePartSchema = z.object({
  partId: z.string().uuid(),
  updates: z.object({
    name: z.string().min(1).max(100).optional(),
    status: z.enum(['emerging', 'acknowledged', 'active', 'integrated']).optional(),
    category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
    age: z.number().min(0).max(100).optional(),
    role: z.string().optional(),
    triggers: z.array(z.string()).optional(),
    emotions: z.array(z.string()).optional(),
    beliefs: z.array(z.string()).optional(),
    somaticMarkers: z.array(z.string()).optional(),
    visualization: z.object({ emoji: z.string(), color: z.string() }).optional(),
    confidenceBoost: z.number().min(0).max(1).optional(),
    last_charged_at: z.string().datetime().optional(),
    last_charge_intensity: z.number().min(0).max(1).optional(),
  }),
  evidence: z.object({
    type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']),
    content: z.string(),
    confidence: z.number().min(0).max(1),
    sessionId: z.string().uuid(),
    timestamp: z.string().datetime()
  }).optional(),
  auditNote: z.string().optional(),
})

const getPartRelationshipsSchema = z.object({
  partId: z.string().uuid().optional(),
  relationshipType: z.enum(['polarized', 'protector-exile', 'allied']).optional(),
  status: z.enum(['active', 'healing', 'resolved']).optional(),
  includePartDetails: z.boolean().default(false),
  limit: z.number().min(1).max(50).default(20),
})

const logRelationshipSchema = z.object({
  partIds: z.array(z.string().uuid()).min(2).max(2),
  type: z.enum(['polarized', 'protector-exile', 'allied']),
  description: z.string().optional(),
  issue: z.string().optional(),
  commonGround: z.string().optional(),
  status: z.enum(['active', 'healing', 'resolved']).optional(),
  polarizationLevel: z.number().min(0).max(1).optional(),
  dynamic: z.object({
    observation: z.string().min(1),
    context: z.string().min(1),
    polarizationChange: z.number().min(-1).max(1).optional(),
    timestamp: z.string().datetime().optional(),
  }).optional(),
  lastAddressed: z.string().datetime().optional(),
  upsert: z.boolean().default(true),
})


export function getPartTools(userId?: string) {
  return {
    searchParts: createTool({
      id: 'searchParts',
      description: 'Search for parts based on query, status, or category',
      inputSchema: searchPartsSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        try {
          return await searchParts(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    getPartById: createTool({
      id: 'getPartById',
      description: 'Get a specific part by its ID',
      inputSchema: getPartByIdSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        try {
          return await getPartById(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    getPartDetail: createTool({
      id: 'getPartDetail',
      description:
        'Retrieves a complete dossier for a given part, including core attributes, relationships, and recent evidence.',
      inputSchema: getPartDetailSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        try {
          return await getPartDetail(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    createEmergingPart: createTool({
      id: 'createEmergingPart',
      description: 'Create a new emerging part (requires 3+ evidence and user confirmation)',
      inputSchema: createEmergingPartSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        try {
          return await createEmergingPart(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    updatePart: createTool({
      id: 'updatePart',
      description: 'Update an existing part with confidence increment and audit trail',
      inputSchema: updatePartSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        try {
          return await updatePart(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    getPartRelationships: createTool({
      id: 'getPartRelationships',
      description:
        'Get part relationships with optional filtering by part, type, status, and include part details',
      inputSchema: getPartRelationshipsSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        try {
          return await getPartRelationships(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    logRelationship: createTool({
      id: 'logRelationship',
      description:
        'Create or update a relationship between two parts; optionally append a dynamic observation and adjust polarization.',
      inputSchema: logRelationshipSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        try {
          return await logRelationship(secureContext);
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
  }
}

