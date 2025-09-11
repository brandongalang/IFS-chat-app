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
        const result = await searchParts(secureContext);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    getPartById: createTool({
      id: 'getPartById',
      description: 'Get a specific part by its ID',
      inputSchema: getPartByIdSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        const result = await getPartById(secureContext);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    getPartDetail: createTool({
      id: 'getPartDetail',
      description:
        'Retrieves a complete dossier for a given part, including core attributes, relationships, and recent evidence.',
      inputSchema: getPartDetailSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        const result = await getPartDetail(secureContext);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    createEmergingPart: createTool({
      id: 'createEmergingPart',
      description: 'Create a new emerging part (requires 3+ evidence and user confirmation)',
      inputSchema: createEmergingPartSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        const result = await createEmergingPart(secureContext);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    updatePart: createTool({
      id: 'updatePart',
      description: 'Update an existing part with confidence increment and audit trail',
      inputSchema: updatePartSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        const result = await updatePart(secureContext);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    getPartRelationships: createTool({
      id: 'getPartRelationships',
      description:
        'Get part relationships with optional filtering by part, type, status, and include part details',
      inputSchema: getPartRelationshipsSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        const result = await getPartRelationships(secureContext);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    logRelationship: createTool({
      id: 'logRelationship',
      description:
        'Create or update a relationship between two parts; optionally append a dynamic observation and adjust polarization.',
      inputSchema: logRelationshipSchema,
      execute: async ({ context }: any) => {
        const secureContext = { ...context, userId };
        const result = await logRelationship(secureContext);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
  }
}

