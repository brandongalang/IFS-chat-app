import { createTool } from '@mastra/core'
import { getServerSupabaseClient } from '@/lib/supabase/clients'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import {
  writeTherapyDataSchema,
  queryTherapyDataSchema,
  updateTherapyDataSchema,
  getSessionContextSchema,
  type WriteTherapyDataInput,
  type QueryTherapyDataInput,
  type UpdateTherapyDataInput,
  type GetSessionContextInput,
} from '@/lib/data/therapy-tools.schema'
import {
  writeTherapyData as writeTherapyDataOp,
  queryTherapyData as queryTherapyDataOp,
  updateTherapyData as updateTherapyDataOp,
  getSessionContext as getSessionContextOp,
} from '@/lib/data/therapy-tools'

async function resolveDependencies(
  baseUserId: string | undefined,
  runtime?: { userId?: string }
): Promise<{ client: SupabaseDatabaseClient; userId: string }> {
  const supabase = await getServerSupabaseClient()
  const userId = baseUserId ?? runtime?.userId
  if (!userId) {
    throw new Error('userId is required for therapy data operations')
  }
  return { client: supabase, userId }
}

export function createTherapyTools(userId?: string) {
  const writeTherapyDataTool = createTool({
    id: 'writeTherapyData',
    description:
      'Write therapeutic data (observations, parts, relationships, session notes). Use this to capture client insights, emerging parts, relationships between parts, or session summaries.',
    inputSchema: writeTherapyDataSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: WriteTherapyDataInput
      runtime?: { userId?: string }
    }) => {
      const input = writeTherapyDataSchema.parse(context)
      const deps = await resolveDependencies(userId, runtime)
      const result = await writeTherapyDataOp(input, deps)
      return result
    },
  })

  const queryTherapyDataTool = createTool({
    id: 'queryTherapyData',
    description:
      'Query therapeutic data (parts, observations, sessions, relationships, timeline). Use this to retrieve information about the client\'s progress, active parts, or session history.',
    inputSchema: queryTherapyDataSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: QueryTherapyDataInput
      runtime?: { userId?: string }
    }) => {
      const input = queryTherapyDataSchema.parse(context)
      const deps = await resolveDependencies(userId, runtime)
      const result = await queryTherapyDataOp(input, deps)
      return result
    },
  })

  const updateTherapyDataTool = createTool({
    id: 'updateTherapyData',
    description:
      'Update existing therapeutic data (parts, observations, sessions). Use this to refine part details, mark observations as complete, or update session summaries.',
    inputSchema: updateTherapyDataSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: UpdateTherapyDataInput
      runtime?: { userId?: string }
    }) => {
      const input = updateTherapyDataSchema.parse(context)
      const deps = await resolveDependencies(userId, runtime)
      const result = await updateTherapyDataOp(input, deps)
      return result
    },
  })

  const getSessionContextTool = createTool({
    id: 'getSessionContext',
    description:
      'Get pre-computed context for the current session, including active parts, recent topics, follow-ups, and suggested focus areas.',
    inputSchema: getSessionContextSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: GetSessionContextInput
      runtime?: { userId?: string }
    }) => {
      const input = getSessionContextSchema.parse(context)
      const deps = await resolveDependencies(userId, runtime)
      const result = await getSessionContextOp(input, deps)
      return result
    },
  })

  return {
    writeTherapyData: writeTherapyDataTool,
    queryTherapyData: queryTherapyDataTool,
    updateTherapyData: updateTherapyDataTool,
    getSessionContext: getSessionContextTool,
  }
}

export type TherapyTools = ReturnType<typeof createTherapyTools>
