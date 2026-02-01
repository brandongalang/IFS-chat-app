import { createTool } from '@mastra/core'
import { getServerSupabaseClient } from '@/lib/supabase/clients'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import {
  searchParts,
  getPartById,
  getPartDetail,
  createEmergingPart,
  updatePart,
  getPartRelationships,
  logRelationship,
} from '@/lib/data/schema/parts-agent'
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
  async function resolveDeps(runtime?: { userId?: string }) {
    const supabase = await getServerSupabaseClient()
    const resolvedUserId = userId ?? runtime?.userId
    if (!resolvedUserId) {
      throw new Error('userId is required to execute part tools')
    }
    return { supabase, userId: resolvedUserId }
  }

  return {
    searchParts: createTool({
      id: 'searchParts',
      description: 'Search for parts based on query, status, or category',
      inputSchema: searchPartsSchema,
      execute: async ({ context, runtime }: any) => {
        const { supabase, userId: resolvedUserId } = await resolveDeps(runtime)
        try {
          return await searchParts(context, { client: supabase, userId: resolvedUserId });
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    getPartById: createTool({
      id: 'getPartById',
      description: 'Get a specific part by its ID',
      inputSchema: getPartByIdSchema,
      execute: async ({ context, runtime }: any) => {
        const { supabase, userId: resolvedUserId } = await resolveDeps(runtime)
        try {
          return await getPartById(context, { client: supabase, userId: resolvedUserId });
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
      execute: async ({ context, runtime }: any) => {
        const { supabase, userId: resolvedUserId } = await resolveDeps(runtime)
        try {
          return await getPartDetail(context, { client: supabase, userId: resolvedUserId });
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    createEmergingPart: createTool({
      id: 'createEmergingPart',
      description: 'Create a new emerging part (requires 3+ evidence and user confirmation)',
      inputSchema: createEmergingPartSchema,
      execute: async ({ context, runtime }: any) => {
        const { supabase, userId: resolvedUserId } = await resolveDeps(runtime)
        try {
          return await createEmergingPart(context, { client: supabase, userId: resolvedUserId });
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
    updatePart: createTool({
      id: 'updatePart',
      description: 'Update an existing part with confidence increment and audit trail',
      inputSchema: updatePartSchema,
      execute: async ({ context, runtime }: any) => {
        const { supabase, userId: resolvedUserId } = await resolveDeps(runtime)
        try {
          return await updatePart(context, { client: supabase, userId: resolvedUserId });
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
      execute: async ({ context, runtime }: any) => {
        const { supabase, userId: resolvedUserId } = await resolveDeps(runtime)
        try {
          return await getPartRelationships(context, { client: supabase, userId: resolvedUserId });
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
      execute: async ({ context, runtime }: any) => {
        const { supabase, userId: resolvedUserId } = await resolveDeps(runtime)
        try {
          return await logRelationship(context, { client: supabase, userId: resolvedUserId });
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    }),
  }
}

