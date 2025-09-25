import { createTool } from '@mastra/core'
import type { ToolExecutionContext } from '@mastra/core/tools'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type {
  Database,
  InsightRow,
  PartRelationshipRow,
  PartRow,
  SessionRow,
  ToolResult,
} from '@/lib/types/database'

const getEnvVar = (keys: string[]): string | undefined => {
  if (typeof process === 'undefined') return undefined
  for (const key of keys) {
    const value = (process.env as Record<string, string | undefined>)[key]
    if (value) return value
  }
  return undefined
}

let cachedSupabase: ReturnType<typeof createServerClient<Database>> | null = null

function getSupabaseClient() {
  if (cachedSupabase) return cachedSupabase

  const url = getEnvVar(['NEXT_PUBLIC_SUPABASE_URL'])
  const anonKey = getEnvVar(['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured.'
    )
  }

  cachedSupabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  })

  return cachedSupabase
}

const getRecentSessionsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  lookbackDays: z.number().int().min(1).max(30).default(7).describe('Number of days to look back'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of sessions to return'),
})

const getActivePartsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of parts to return'),
})

const getPolarizedRelationshipsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of relationships to return'),
})

const getRecentInsightsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID for the search'),
  lookbackDays: z.number().int().min(1).max(90).default(14).describe('Number of days to look back'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of insights to return'),
})

const toToolError = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error occurred')

const daysAgoIso = (days: number) => {
  const boundary = new Date()
  boundary.setDate(boundary.getDate() - days)
  return boundary.toISOString()
}

export async function getRecentSessions(
  input: z.infer<typeof getRecentSessionsSchema>
): Promise<ToolResult<SessionRow[]>> {
  try {
    const validated = getRecentSessionsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', daysAgoIso(validated.lookbackDays))
      .order('start_time', { ascending: false })
      .limit(validated.limit)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [], confidence: 0.9 }
  } catch (error) {
    return { success: false, error: toToolError(error) }
  }
}

export async function getActiveParts(
  input: z.infer<typeof getActivePartsSchema>
): Promise<ToolResult<PartRow[]>> {
  try {
    const validated = getActivePartsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false, nullsFirst: false })
      .limit(validated.limit)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [], confidence: 0.85 }
  } catch (error) {
    return { success: false, error: toToolError(error) }
  }
}

export async function getPolarizedRelationships(
  input: z.infer<typeof getPolarizedRelationshipsSchema>
): Promise<ToolResult<PartRelationshipRow[]>> {
  try {
    const validated = getPolarizedRelationshipsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('part_relationships')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'polarized')
      .order('updated_at', { ascending: false })
      .limit(validated.limit)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [], confidence: 0.6 }
  } catch (error) {
    return { success: false, error: toToolError(error) }
  }
}

export async function getRecentInsights(
  input: z.infer<typeof getRecentInsightsSchema>
): Promise<ToolResult<InsightRow[]>> {
  try {
    const validated = getRecentInsightsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', daysAgoIso(validated.lookbackDays))
      .order('created_at', { ascending: false })
      .limit(validated.limit)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [], confidence: 0.75 }
  } catch (error) {
    return { success: false, error: toToolError(error) }
  }
}

export const getRecentSessionsTool = createTool({
  id: 'getRecentSessions',
  description: 'Retrieves the most recent chat sessions for a user within a given lookback period.',
  inputSchema: getRecentSessionsSchema,
  async execute(context: ToolExecutionContext<typeof getRecentSessionsSchema>): Promise<SessionRow[]> {
    const result = await getRecentSessions(context.context)
    if (!result.success) throw new Error(result.error ?? 'Failed to load recent sessions')
    return result.data ?? []
  },
})

export const getActivePartsTool = createTool({
  id: 'getActiveParts',
  description: 'Retrieves the most active or recently updated parts for a user.',
  inputSchema: getActivePartsSchema,
  async execute(context: ToolExecutionContext<typeof getActivePartsSchema>): Promise<PartRow[]> {
    const result = await getActiveParts(context.context)
    if (!result.success) throw new Error(result.error ?? 'Failed to load active parts')
    return result.data ?? []
  },
})

export const getPolarizedRelationshipsTool = createTool({
  id: 'getPolarizedRelationships',
  description: 'Retrieves part relationships that are marked as polarized.',
  inputSchema: getPolarizedRelationshipsSchema,
  async execute(context: ToolExecutionContext<typeof getPolarizedRelationshipsSchema>): Promise<PartRelationshipRow[]> {
    const result = await getPolarizedRelationships(context.context)
    if (!result.success) throw new Error(result.error ?? 'Failed to load polarized relationships')
    return result.data ?? []
  },
})

export const getRecentInsightsTool = createTool({
  id: 'getRecentInsights',
  description: 'Retrieves the most recent insights that have been generated for a user.',
  inputSchema: getRecentInsightsSchema,
  async execute(context: ToolExecutionContext<typeof getRecentInsightsSchema>): Promise<InsightRow[]> {
    const result = await getRecentInsights(context.context)
    if (!result.success) throw new Error(result.error ?? 'Failed to load insights')
    return result.data ?? []
  },
})

export const insightResearchTools = {
  getRecentSessions: getRecentSessionsTool,
  getActiveParts: getActivePartsTool,
  getPolarizedRelationships: getPolarizedRelationshipsTool,
  getRecentInsights: getRecentInsightsTool,
}
