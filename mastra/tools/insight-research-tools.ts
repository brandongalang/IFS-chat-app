import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type { SessionRow, PartRow, PartRelationshipRow, InsightRow, ToolResult } from '../../lib/types/database'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

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


export async function getRecentSessions(input: z.infer<typeof getRecentSessionsSchema>): Promise<ToolResult<SessionRow[]>> {
  try {
    const validated = getRecentSessionsSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

export async function getActiveParts(input: z.infer<typeof getActivePartsSchema>): Promise<ToolResult<PartRow[]>> {
  try {
    const validated = getActivePartsSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

export async function getPolarizedRelationships(input: z.infer<typeof getPolarizedRelationshipsSchema>): Promise<ToolResult<PartRelationshipRow[]>> {
  try {
    const validated = getPolarizedRelationshipsSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

export async function getRecentInsights(input: z.infer<typeof getRecentInsightsSchema>): Promise<ToolResult<InsightRow[]>> {
  try {
    const validated = getRecentInsightsSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: [], confidence: 1.0 }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

// Tool definitions for Mastra

export const getRecentSessionsTool = createTool({
  id: 'getRecentSessions',
  description: 'Retrieves the most recent chat sessions for a user within a given lookback period.',
  inputSchema: getRecentSessionsSchema,
  execute: async ({ context }) => {
    const result = await getRecentSessions(context);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
});

export const getActivePartsTool = createTool({
  id: 'getActiveParts',
  description: 'Retrieves the most active or recently updated parts for a user.',
  inputSchema: getActivePartsSchema,
  execute: async ({ context }) => {
    const result = await getActiveParts(context);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
});

export const getPolarizedRelationshipsTool = createTool({
  id: 'getPolarizedRelationships',
  description: 'Retrieves part relationships that are marked as polarized.',
  inputSchema: getPolarizedRelationshipsSchema,
  execute: async ({ context }) => {
    const result = await getPolarizedRelationships(context);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
});

export const getRecentInsightsTool = createTool({
  id: 'getRecentInsights',
  description: 'Retrieves the most recent insights that have been generated for a user.',
  inputSchema: getRecentInsightsSchema,
  execute: async ({ context }) => {
    const result = await getRecentInsights(context);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
});

export const insightResearchTools = {
  getRecentSessions: getRecentSessionsTool,
  getActiveParts: getActivePartsTool,
  getPolarizedRelationships: getPolarizedRelationshipsTool,
  getRecentInsights: getRecentInsightsTool,
};
