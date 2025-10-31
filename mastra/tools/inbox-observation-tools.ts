import { createTool } from '@mastra/core'
import { z } from 'zod'

import { resolveUserId } from '@/config/dev'
import { getServerSupabaseClient } from '@/lib/supabase/clients'
import { listCheckIns, searchCheckIns, getCheckInDetail } from '@/lib/inbox/search/checkins'
import {
  searchParts,
  getPartById,
  getPartDetail,
} from '@/lib/data/schema/parts-agent'
import {
  writeTherapyData,
  queryTherapyData,
  updateTherapyData,
} from '@/lib/data/therapy-tools'
import {
  searchPartsSchema,
  getPartByIdSchema,
  getPartDetailSchema,
} from './part-schemas'
import type { WriteTherapyDataInput, QueryTherapyDataInput, UpdateTherapyDataInput } from '@/lib/data/therapy-tools.schema'
import {
  writeTherapyDataSchema,
  queryTherapyDataSchema,
  updateTherapyDataSchema,
} from '@/lib/data/therapy-tools.schema'

type ToolRuntime = { userId?: string }

export function createObservationResearchTools(
  baseUserId: string | null | undefined,
) {
  const verbose = process.env.IFS_VERBOSE === 'true'
  const normalizedBaseUserId = typeof baseUserId === 'string' && baseUserId.trim().length ? baseUserId.trim() : null

  const resolveUser = (runtime?: ToolRuntime) => resolveToolUserId(normalizedBaseUserId, runtime)

  async function resolveSupabase(runtime?: ToolRuntime) {
    // Force user-scoped client to keep RLS/tenant boundaries intact.
    const supabase = await getServerSupabaseClient({ useServiceRole: false })
    const userId = resolveUser(runtime)
    return { supabase, userId }
  }

  const searchPartsTool = createTool({
    id: 'searchParts',
    description: 'Search for parts by name, status, or characteristics.',
    inputSchema: searchPartsSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof searchPartsSchema>; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const { supabase, userId } = await resolveSupabase(runtime)
      const input = searchPartsSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] searchParts:start', { userId, args: input })
        const out = await searchParts(input, { client: supabase, userId })
        if (verbose) console.log('[agent:tool_use] searchParts:done', { userId, ms: Date.now() - started, items: Array.isArray(out?.results) ? out.results.length : undefined })
        return out
      } catch (err) {
        console.error('[agent:tool_use] searchParts:error', { userId, ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const getPartByIdTool = createTool({
    id: 'getPartById',
    description: 'Get a specific part by its ID.',
    inputSchema: getPartByIdSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof getPartByIdSchema>; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const { supabase, userId } = await resolveSupabase(runtime)
      const input = getPartByIdSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] getPartById:start', { userId, args: input })
        const out = await getPartById(input, { client: supabase, userId })
        if (verbose) console.log('[agent:tool_use] getPartById:done', { userId, ms: Date.now() - started })
        return out
      } catch (err) {
        console.error('[agent:tool_use] getPartById:error', { userId, ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const getPartDetailTool = createTool({
    id: 'getPartDetail',
    description: 'Get detailed information about a part including relationships and history.',
    inputSchema: getPartDetailSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof getPartDetailSchema>; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const { supabase, userId } = await resolveSupabase(runtime)
      const input = getPartDetailSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] getPartDetail:start', { userId, args: input })
        const out = await getPartDetail(input, { client: supabase, userId })
        if (verbose) console.log('[agent:tool_use] getPartDetail:done', { userId, ms: Date.now() - started })
        return out
      } catch (err) {
        console.error('[agent:tool_use] getPartDetail:error', { userId, ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const queryTherapyDataTool = createTool({
    id: 'queryTherapyData',
    description: 'Query therapeutic data (observations, session notes, parts relationships).',
    inputSchema: queryTherapyDataSchema,
    execute: async ({ context, runtime }: { context: QueryTherapyDataInput; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const { supabase, userId } = await resolveSupabase(runtime)
      const input = queryTherapyDataSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] queryTherapyData:start', { userId, args: { ...input, query: typeof (input as any)?.query === 'string' ? (input as any).query.slice(0, 120) : undefined } })
        const out = await queryTherapyData(input, { client: supabase, userId })
        if (verbose) console.log('[agent:tool_use] queryTherapyData:done', { userId, ms: Date.now() - started })
        return out
      } catch (err) {
        console.error('[agent:tool_use] queryTherapyData:error', { userId, ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const writeTherapyDataTool = createTool({
    id: 'writeTherapyData',
    description: 'Write therapeutic data (observations, parts, relationships, session notes).',
    inputSchema: writeTherapyDataSchema,
    execute: async ({ context, runtime }: { context: WriteTherapyDataInput; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const { supabase, userId } = await resolveSupabase(runtime)
      const input = writeTherapyDataSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] writeTherapyData:start', { userId })
        const out = await writeTherapyData(input, { client: supabase, userId })
        if (verbose) console.log('[agent:tool_use] writeTherapyData:done', { userId, ms: Date.now() - started })
        return out
      } catch (err) {
        console.error('[agent:tool_use] writeTherapyData:error', { userId, ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const updateTherapyDataTool = createTool({
    id: 'updateTherapyData',
    description: 'Update existing therapeutic data entries.',
    inputSchema: updateTherapyDataSchema,
    execute: async ({ context, runtime }: { context: UpdateTherapyDataInput; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const { supabase, userId } = await resolveSupabase(runtime)
      const input = updateTherapyDataSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] updateTherapyData:start', { userId })
        const out = await updateTherapyData(input, { client: supabase, userId })
        if (verbose) console.log('[agent:tool_use] updateTherapyData:done', { userId, ms: Date.now() - started })
        return out
      } catch (err) {
        console.error('[agent:tool_use] updateTherapyData:error', { userId, ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const checkInListSchema = z.object({
    lookbackDays: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).strict()

  const checkInSearchSchema = z.object({
    query: z.string().min(2).max(200),
    lookbackDays: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).strict()

  const checkInDetailSchema = z.object({
    checkInId: z.string().uuid(),
  }).strict()

  const listCheckInsTool = createTool({
    id: 'listCheckIns',
    description: 'Lists recent check-ins with intention and reflection summaries.',
    inputSchema: checkInListSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof checkInListSchema>; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const input = checkInListSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] listCheckIns:start', { userId: resolveUser(runtime), args: input })
        const out = await listCheckIns(
        {
          userId: resolveUser(runtime),
          lookbackDays: input.lookbackDays,
          limit: input.limit,
        },
        )
        if (verbose) console.log('[agent:tool_use] listCheckIns:done', { userId: resolveUser(runtime), ms: Date.now() - started, count: Array.isArray(out?.results) ? out.results.length : undefined })
        return out
      } catch (err) {
        console.error('[agent:tool_use] listCheckIns:error', { userId: resolveUser(runtime), ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const searchCheckInsTool = createTool({
    id: 'searchCheckIns',
    description: 'Searches check-ins for matching reflections or gratitude notes.',
    inputSchema: checkInSearchSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof checkInSearchSchema>; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const input = checkInSearchSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] searchCheckIns:start', { userId: resolveUser(runtime), args: { ...input, query: input.query.slice(0, 120) } })
        const out = await searchCheckIns(
        {
          userId: resolveUser(runtime),
          query: input.query,
          lookbackDays: input.lookbackDays,
          limit: input.limit,
        },
        )
        if (verbose) console.log('[agent:tool_use] searchCheckIns:done', { userId: resolveUser(runtime), ms: Date.now() - started, count: Array.isArray(out?.results) ? out.results.length : undefined })
        return out
      } catch (err) {
        console.error('[agent:tool_use] searchCheckIns:error', { userId: resolveUser(runtime), ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  const getCheckInDetailTool = createTool({
    id: 'getCheckInDetail',
    description: 'Retrieves the full detail for a specific check-in entry.',
    inputSchema: checkInDetailSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof checkInDetailSchema>; runtime?: ToolRuntime }) => {
      const started = Date.now()
      const input = checkInDetailSchema.parse(context)
      try {
        if (verbose) console.log('[agent:tool_use] getCheckInDetail:start', { userId: resolveUser(runtime), args: input })
        const out = await getCheckInDetail(
        {
          userId: resolveUser(runtime),
          checkInId: input.checkInId,
        },
        )
        if (verbose) console.log('[agent:tool_use] getCheckInDetail:done', { userId: resolveUser(runtime), ms: Date.now() - started })
        return out
      } catch (err) {
        console.error('[agent:tool_use] getCheckInDetail:error', { userId: resolveUser(runtime), ms: Date.now() - started, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },
  })

  return {
    searchParts: searchPartsTool,
    getPartById: getPartByIdTool,
    getPartDetail: getPartDetailTool,
    queryTherapyData: queryTherapyDataTool,
    writeTherapyData: writeTherapyDataTool,
    updateTherapyData: updateTherapyDataTool,
    listCheckIns: listCheckInsTool,
    searchCheckIns: searchCheckInsTool,
    getCheckInDetail: getCheckInDetailTool,
  }
}

export type ObservationResearchTools = ReturnType<typeof createObservationResearchTools>

function resolveToolUserId(baseUserId: string | null, runtime?: ToolRuntime): string {
  return resolveUserId(runtime?.userId ?? baseUserId ?? undefined)
}
