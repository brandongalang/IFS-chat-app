import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { getServerSupabaseClient } from '@/lib/supabase/clients'
import { searchParts, listPartDisplayRecords } from '@/lib/data/schema/server'
import { listRelationships } from '@/lib/data/schema/relationships'
import type { SessionRowV2, PartRowV2, PartRelationshipRowV2 } from '@/lib/data/schema/types'
import type { PartDisplayRow } from '@/lib/data/schema/context'
import type { InsightRow } from '@/lib/types/database'

// Input schemas for tool validation
const getRecentSessionsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  lookbackDays: z.number().min(1).max(30).default(7).describe('Number of days to look back'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of sessions to return'),
});

const getActivePartsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of parts to return'),
});

const getPolarizedRelationshipsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of relationships to return'),
});

const getRecentInsightsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  lookbackDays: z.number().min(1).max(90).default(14).describe('Number of days to look back'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of insights to return'),
});


export async function getRecentSessions(input: z.infer<typeof getRecentSessionsSchema> & { userId?: string }): Promise<SessionRowV2[]> {
  try {
    const validated = getRecentSessionsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    const supabase = await getServerSupabaseClient()
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - validated.lookbackDays)

    const { data: sessions, error } = await supabase
      .from('sessions_v2')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', lookbackDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(validated.limit)

    if (error) {
      throw new Error(`Failed to fetch recent sessions: ${error.message}`)
    }

    return sessions || []
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

export async function getActiveParts(input: z.infer<typeof getActivePartsSchema> & { userId?: string }): Promise<PartDisplayRow[]> {
  try {
    const validated = getActivePartsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    
    // Get parts with recent activity (parts with recent observations or session references)  
    const parts = await listPartDisplayRecords({ userId }, validated.limit)
    
    return parts
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

export async function getPolarizedRelationships(input: z.infer<typeof getPolarizedRelationshipsSchema> & { userId?: string }): Promise<PartRelationshipRowV2[]> {
  try {
    const validated = getPolarizedRelationshipsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    const supabase = await getServerSupabaseClient()
    
    // Get relationships that are marked as 'conflicts' (corresponds to legacy 'polarized')
    const polarizedRelationships = await listRelationships(
      { client: supabase, userId }, 
      { type: 'conflicts' }
    )
    
    // Filter by relationships with high tension/strength (> 0.5) if strength is available
    const highTensionRelationships = polarizedRelationships.filter(rel => 
      !rel.strength || rel.strength > 0.5
    )
    
    return highTensionRelationships.slice(0, validated.limit)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

export async function getRecentInsights(input: z.infer<typeof getRecentInsightsSchema> & { userId?: string }): Promise<InsightRow[]> {
  try {
    const validated = getRecentInsightsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    const supabase = await getServerSupabaseClient()
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - validated.lookbackDays)

    // Query from inbox_items (unified table) instead of legacy 'insights' table
    // which was renamed to 'insights_legacy' in migration 130
    const { data: items, error } = await supabase
      .from('inbox_items')
      .select('id,user_id,type,status,content,metadata,rating,feedback,revealed_at,actioned_at,created_at,updated_at')
      .eq('user_id', userId)
      .gte('created_at', lookbackDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(validated.limit)

    if (error) {
      throw new Error(`Failed to fetch recent insights: ${error.message}`)
    }

    // Map inbox_items rows to InsightRow format for backward compatibility
    return (items || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      type: item.type as InsightRow['type'],
      status: item.status as InsightRow['status'],
      content: item.content as InsightRow['content'],
      rating: item.rating,
      feedback: item.feedback,
      revealed_at: item.revealed_at,
      actioned_at: item.actioned_at,
      meta: item.metadata, // inbox_items uses 'metadata', InsightRow expects 'meta'
      created_at: item.created_at,
      updated_at: item.updated_at,
    }))
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

// Tool definitions for Mastra

export const getRecentSessionsTool = createTool({
  id: 'getRecentSessions',
  description: 'Retrieves the most recent chat sessions for a user within a given lookback period.',
  inputSchema: getRecentSessionsSchema,
  execute: async ({ context }) => {
    const userId = resolveUserId(context.userId);
    return await getRecentSessions({ ...context, userId });
  }
});

export const getActivePartsTool = createTool({
  id: 'getActiveParts',
  description: 'Retrieves the most active or recently updated parts for a user.',
  inputSchema: getActivePartsSchema,
  execute: async ({ context }) => {
    const userId = resolveUserId(context.userId);
    return await getActiveParts({ ...context, userId });
  }
});

export const getPolarizedRelationshipsTool = createTool({
  id: 'getPolarizedRelationships',
  description: 'Retrieves part relationships that are marked as polarized.',
  inputSchema: getPolarizedRelationshipsSchema,
  execute: async ({ context }) => {
    const userId = resolveUserId(context.userId);
    return await getPolarizedRelationships({ ...context, userId });
  }
});

export const getRecentInsightsTool = createTool({
  id: 'getRecentInsights',
  description: 'Retrieves the most recent insights that have been generated for a user.',
  inputSchema: getRecentInsightsSchema,
  execute: async ({ context }) => {
    const userId = resolveUserId(context.userId);
    return await getRecentInsights({ ...context, userId });
  }
});

export function createInsightResearchTools(userId?: string) {
  if (!userId) {
    return {
      getRecentSessions: getRecentSessionsTool,
      getActiveParts: getActivePartsTool,
      getPolarizedRelationships: getPolarizedRelationshipsTool,
      getRecentInsights: getRecentInsightsTool,
    }
  }

  return {
    getRecentSessions: createTool({
      id: getRecentSessionsTool.id,
      description: getRecentSessionsTool.description,
      inputSchema: getRecentSessionsTool.inputSchema,
      execute: async ({ context }) => {
        const effectiveUserId = context.userId || userId
        return await getRecentSessions({ ...context, userId: effectiveUserId })
      },
    }),
    getActiveParts: createTool({
      id: getActivePartsTool.id,
      description: getActivePartsTool.description,
      inputSchema: getActivePartsTool.inputSchema,
      execute: async ({ context }) => {
        const effectiveUserId = context.userId || userId
        return await getActiveParts({ ...context, userId: effectiveUserId })
      },
    }),
    getPolarizedRelationships: createTool({
      id: getPolarizedRelationshipsTool.id,
      description: getPolarizedRelationshipsTool.description,
      inputSchema: getPolarizedRelationshipsTool.inputSchema,
      execute: async ({ context }) => {
        const effectiveUserId = context.userId || userId
        return await getPolarizedRelationships({ ...context, userId: effectiveUserId })
      },
    }),
    getRecentInsights: createTool({
      id: getRecentInsightsTool.id,
      description: getRecentInsightsTool.description,
      inputSchema: getRecentInsightsTool.inputSchema,
      execute: async ({ context }) => {
        const effectiveUserId = context.userId || userId
        return await getRecentInsights({ ...context, userId: effectiveUserId })
      },
    }),
  }
}

export const insightResearchTools = {
  getRecentSessions: getRecentSessionsTool,
  getActiveParts: getActivePartsTool,
  getPolarizedRelationships: getPolarizedRelationshipsTool,
  getRecentInsights: getRecentInsightsTool,
};