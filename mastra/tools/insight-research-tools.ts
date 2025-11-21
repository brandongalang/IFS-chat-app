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


export async function getRecentSessions(input: z.infer<typeof getRecentSessionsSchema> & { userId?: string; useServiceRole?: boolean }): Promise<SessionRowV2[]> {
  try {
    const validated = getRecentSessionsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    const useServiceRole = input.useServiceRole ?? false
    const supabase = await getServerSupabaseClient({ useServiceRole })
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

export async function getActiveParts(input: z.infer<typeof getActivePartsSchema> & { userId?: string; useServiceRole?: boolean }): Promise<PartDisplayRow[]> {
  try {
    const validated = getActivePartsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    const useServiceRole = input.useServiceRole ?? false
    const client = await getServerSupabaseClient({ useServiceRole })
    
    // Get parts with recent activity (parts with recent observations or session references)  
    const parts = await listPartDisplayRecords({ userId, client }, validated.limit)
    
    return parts
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

export async function getPolarizedRelationships(input: z.infer<typeof getPolarizedRelationshipsSchema> & { userId?: string; useServiceRole?: boolean }): Promise<PartRelationshipRowV2[]> {
  try {
    const validated = getPolarizedRelationshipsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    const useServiceRole = input.useServiceRole ?? false
    const supabase = await getServerSupabaseClient({ useServiceRole })
    
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

export async function getRecentInsights(input: z.infer<typeof getRecentInsightsSchema> & { userId?: string; useServiceRole?: boolean }): Promise<InsightRow[]> {
  try {
    const validated = getRecentInsightsSchema.parse(input)
    const userId = resolveUserId(validated.userId || input.userId)
    const useServiceRole = input.useServiceRole ?? false
    const supabase = await getServerSupabaseClient({ useServiceRole })
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - validated.lookbackDays)

    const { data: insights, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', lookbackDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(validated.limit)

    if (error) {
      throw new Error(`Failed to fetch recent insights: ${error.message}`)
    }

    return insights || []
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    throw new Error(errMsg)
  }
}

// Factory for creating tools with configuration
function createTools(config?: { useServiceRole?: boolean }) {
  const useServiceRoleConfig = config?.useServiceRole;

  const getRecentSessionsTool = createTool({
    id: 'getRecentSessions',
    description: 'Retrieves the most recent chat sessions for a user within a given lookback period.',
    inputSchema: getRecentSessionsSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof getRecentSessionsSchema>; runtime?: { useServiceRole?: boolean } }) => {
      const userId = resolveUserId(context.userId);
      const useServiceRole = runtime?.useServiceRole ?? useServiceRoleConfig;
      return await getRecentSessions({ ...context, userId, useServiceRole });
    }
  });

  const getActivePartsTool = createTool({
    id: 'getActiveParts',
    description: 'Retrieves the most active or recently updated parts for a user.',
    inputSchema: getActivePartsSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof getActivePartsSchema>; runtime?: { useServiceRole?: boolean } }) => {
      const userId = resolveUserId(context.userId);
      const useServiceRole = runtime?.useServiceRole ?? useServiceRoleConfig;
      return await getActiveParts({ ...context, userId, useServiceRole });
    }
  });

  const getPolarizedRelationshipsTool = createTool({
    id: 'getPolarizedRelationships',
    description: 'Retrieves part relationships that are marked as polarized.',
    inputSchema: getPolarizedRelationshipsSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof getPolarizedRelationshipsSchema>; runtime?: { useServiceRole?: boolean } }) => {
      const userId = resolveUserId(context.userId);
      const useServiceRole = runtime?.useServiceRole ?? useServiceRoleConfig;
      return await getPolarizedRelationships({ ...context, userId, useServiceRole });
    }
  });

  const getRecentInsightsTool = createTool({
    id: 'getRecentInsights',
    description: 'Retrieves the most recent insights that have been generated for a user.',
    inputSchema: getRecentInsightsSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof getRecentInsightsSchema>; runtime?: { useServiceRole?: boolean } }) => {
      const userId = resolveUserId(context.userId);
      const useServiceRole = runtime?.useServiceRole ?? useServiceRoleConfig;
      return await getRecentInsights({ ...context, userId, useServiceRole });
    }
  });

  return {
    getRecentSessions: getRecentSessionsTool,
    getActiveParts: getActivePartsTool,
    getPolarizedRelationships: getPolarizedRelationshipsTool,
    getRecentInsights: getRecentInsightsTool,
  }
}

export function createInsightResearchTools(userId?: string, config?: { useServiceRole?: boolean }) {
  return createTools(config)
}

// Default instance for backward compatibility
const tools = createTools()
export const getRecentSessionsTool = tools.getRecentSessions
export const getActivePartsTool = tools.getActiveParts
export const getPolarizedRelationshipsTool = tools.getPolarizedRelationships
export const getRecentInsightsTool = tools.getRecentInsights

export const insightResearchTools = {
  getRecentSessions: getRecentSessionsTool,
  getActiveParts: getActivePartsTool,
  getPolarizedRelationships: getPolarizedRelationshipsTool,
  getRecentInsights: getRecentInsightsTool,
};
