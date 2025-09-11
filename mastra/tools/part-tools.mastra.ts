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
  searchPartsSchema,
  getPartByIdSchema,
  getPartDetailSchema,
  createEmergingPartSchema,
  updatePartSchema,
  getPartRelationshipsSchema,
  logRelationshipSchema,
} from './part-schemas'


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

