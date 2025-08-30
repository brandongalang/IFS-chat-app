import { createTool } from '@mastra/core'
import { createServerClient } from '@supabase/ssr'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { actionLogger } from '../../lib/database/action-logger'
import { resolveUserId, devLog, dev } from '@/config/dev'
import type { Database, SessionRow, PartRow, PartRelationshipRow, InsightRow, ToolResult } from '../../lib/types/database'

// Helper to resolve env with fallbacks
function getEnvVar(keys: string[]): string | undefined {
  const nodeEnv = typeof process !== 'undefined' ? (process as any).env : undefined;
  if (nodeEnv) {
    for (const k of keys) {
      const v = nodeEnv[k];
      if (v) return v as string;
    }
  }
  return undefined;
}

// Helper function to get Supabase client
function getSupabaseClient() {
  const url = getEnvVar(['NEXT_PUBLIC_SUPABASE_URL']);
  const anonKey = getEnvVar(['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  const serviceRole = getEnvVar(['SUPABASE_SERVICE_ROLE_KEY']);

  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key are required.');
  }

  if (typeof window === 'undefined' && dev.enabled && serviceRole) {
    return createBrowserClient<Database>(url, serviceRole);
  }

  if (typeof window !== 'undefined') {
    return createBrowserClient<Database>(url, anonKey);
  } else {
    return createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll: () => [],
        setAll: () => {}
      }
    });
  }
}

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
    const validated = getRecentSessionsSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - validated.lookbackDays);

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', lookbackDate.toISOString())
      .order('start_time', { ascending: false })
      .limit(validated.limit);

    if (error) return { success: false, error: `Database error: ${error.message}` };
    return { success: true, data: data || [], confidence: 1.0 };
  } catch (error) {
    const errMsg = error instanceof Error ? (dev.verbose ? (error.stack || error.message) : error.message) : 'Unknown error occurred';
    return { success: false, error: errMsg };
  }
}

export async function getActiveParts(input: z.infer<typeof getActivePartsSchema>): Promise<ToolResult<PartRow[]>> {
  try {
    const validated = getActivePartsSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false, nulls: 'last' })
      .limit(validated.limit);

    if (error) return { success: false, error: `Database error: ${error.message}` };
    return { success: true, data: data || [], confidence: 1.0 };
  } catch (error) {
    const errMsg = error instanceof Error ? (dev.verbose ? (error.stack || error.message) : error.message) : 'Unknown error occurred';
    return { success: false, error: errMsg };
  }
}

export async function getPolarizedRelationships(input: z.infer<typeof getPolarizedRelationshipsSchema>): Promise<ToolResult<PartRelationshipRow[]>> {
  try {
    const validated = getPolarizedRelationshipsSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('part_relationships')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'polarized')
      .order('polarization_level', { ascending: false })
      .limit(validated.limit);

    if (error) return { success: false, error: `Database error: ${error.message}` };
    return { success: true, data: data || [], confidence: 1.0 };
  } catch (error) {
    const errMsg = error instanceof Error ? (dev.verbose ? (error.stack || error.message) : error.message) : 'Unknown error occurred';
    return { success: false, error: errMsg };
  }
}

export async function getRecentInsights(input: z.infer<typeof getRecentInsightsSchema>): Promise<ToolResult<InsightRow[]>> {
  try {
    const validated = getRecentInsightsSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - validated.lookbackDays);

    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', lookbackDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(validated.limit);

    if (error) return { success: false, error: `Database error: ${error.message}` };
    return { success: true, data: data || [], confidence: 1.0 };
  } catch (error) {
    const errMsg = error instanceof Error ? (dev.verbose ? (error.stack || error.message) : error.message) : 'Unknown error occurred';
    return { success: false, error: errMsg };
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
