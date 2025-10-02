import { createTool } from '@mastra/core'
import { z } from 'zod'

import { resolveUserId } from '@/config/dev'
import {
  getCheckInDetail,
  getSessionDetail,
  listCheckIns,
  listMarkdownFiles,
  listSessions,
  readMarkdown,
  searchCheckIns,
  searchMarkdown,
  searchSessions,
} from '@/lib/inbox/search'
import { createObservationTelemetryClient } from '@/lib/inbox/search/telemetry'
import type { ObservationTelemetryClient } from '@/lib/inbox/search/types'

type MarkdownGlob = string | string[] | undefined

type ToolRuntime = { userId?: string }

type ObservationResearchToolOptions = {
  dependencies?: Partial<ObservationSearchDependencies>
  telemetry?: ObservationTelemetryClient | null
}

const markdownGlobSchema = z.union([z.string().min(1), z.array(z.string().min(1))]).optional()

const markdownListSchema = z
  .object({
    prefix: z.string().min(1).max(256).optional(),
    glob: markdownGlobSchema,
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()

const markdownSearchSchema = z
  .object({
    pattern: z.string().min(2).max(200),
    prefix: z.string().min(1).max(256).optional(),
    glob: markdownGlobSchema,
    regex: z.boolean().optional(),
    flags: z.string().regex(/^[imsuy]*$/u).optional(),
    ignoreCase: z.boolean().optional(),
    maxMatches: z.number().int().min(1).max(50).optional(),
    timeoutMs: z.number().int().min(50).max(2_000).optional(),
    contextBefore: z.number().int().min(0).max(5).optional(),
    contextAfter: z.number().int().min(0).max(5).optional(),
  })
  .strict()

const markdownReadSchema = z
  .object({
    path: z.string().min(1).max(512),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(512).max(8192).optional(),
  })
  .strict()

const sessionListSchema = z
  .object({
    lookbackDays: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()

const sessionSearchSchema = z
  .object({
    query: z.string().min(2).max(200),
    lookbackDays: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    fields: z.array(z.enum(['summary', 'messages'])).min(1).max(2).optional(),
  })
  .strict()

const sessionDetailSchema = z
  .object({
    sessionId: z.string().uuid(),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(5).max(100).optional(),
  })
  .strict()

const checkInListSchema = z
  .object({
    lookbackDays: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()

const checkInSearchSchema = z
  .object({
    query: z.string().min(2).max(200),
    lookbackDays: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()

const checkInDetailSchema = z
  .object({
    checkInId: z.string().uuid(),
  })
  .strict()

type ObservationSearchDependencies = {
  markdown: {
    list: typeof listMarkdownFiles
    search: typeof searchMarkdown
    read: typeof readMarkdown
  }
  sessions: {
    list: typeof listSessions
    search: typeof searchSessions
    detail: typeof getSessionDetail
  }
  checkIns: {
    list: typeof listCheckIns
    search: typeof searchCheckIns
    detail: typeof getCheckInDetail
  }
}

const defaultDependencies: ObservationSearchDependencies = {
  markdown: {
    list: listMarkdownFiles,
    search: searchMarkdown,
    read: readMarkdown,
  },
  sessions: {
    list: listSessions,
    search: searchSessions,
    detail: getSessionDetail,
  },
  checkIns: {
    list: listCheckIns,
    search: searchCheckIns,
    detail: getCheckInDetail,
  },
}

export function createObservationResearchTools(
  baseUserId: string | null | undefined,
  options: ObservationResearchToolOptions = {},
) {
  const overrides = options.dependencies ?? {}
  const normalizedBaseUserId = typeof baseUserId === 'string' && baseUserId.trim().length ? baseUserId.trim() : null

  let telemetryCache: ObservationTelemetryClient | null | undefined
  const resolveTelemetry = (): ObservationTelemetryClient | null => {
    if (telemetryCache !== undefined) return telemetryCache
    if (options.telemetry !== undefined) {
      telemetryCache = options.telemetry
    } else {
      telemetryCache = createDefaultTelemetryClient()
    }
    return telemetryCache
  }

  const markdownListImpl = overrides.markdown?.list ?? defaultDependencies.markdown.list
  const markdownReadImpl = overrides.markdown?.read ?? defaultDependencies.markdown.read
  const markdownSearchImpl = overrides.markdown?.search ?? defaultDependencies.markdown.search

  const sessionListImpl = overrides.sessions?.list ?? defaultDependencies.sessions.list
  const sessionSearchImpl = overrides.sessions?.search ?? defaultDependencies.sessions.search
  const sessionDetailImpl = overrides.sessions?.detail ?? defaultDependencies.sessions.detail

  const checkInListImpl = overrides.checkIns?.list ?? defaultDependencies.checkIns.list
  const checkInSearchImpl = overrides.checkIns?.search ?? defaultDependencies.checkIns.search
  const checkInDetailImpl = overrides.checkIns?.detail ?? defaultDependencies.checkIns.detail

  const resolveUser = (runtime?: ToolRuntime) => resolveToolUserId(normalizedBaseUserId, runtime)

  const listMarkdownTool = createTool({
    id: 'listMarkdown',
    description: 'Lists markdown files scoped to the user memory root.',
    inputSchema: markdownListSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: z.infer<typeof markdownListSchema>
      runtime?: ToolRuntime
    }) => {
      const input = markdownListSchema.parse(context)
      return markdownListImpl({
        userId: resolveUser(runtime),
        prefix: input.prefix,
        glob: input.glob,
        limit: input.limit,
      })
    },
  })

  const searchMarkdownTool = createTool({
    id: 'searchMarkdown',
    description: 'Searches user markdown files for a pattern with optional regex and context.',
    inputSchema: markdownSearchSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: z.infer<typeof markdownSearchSchema>
      runtime?: ToolRuntime
    }) => {
      const input = markdownSearchSchema.parse(context)
      return markdownSearchImpl(
        {
          userId: resolveUser(runtime),
          pattern: input.pattern,
          prefix: input.prefix,
          glob: input.glob,
          regex: input.regex,
          flags: input.flags,
          ignoreCase: input.ignoreCase,
          maxMatches: input.maxMatches,
          timeoutMs: input.timeoutMs,
          contextBefore: input.contextBefore,
          contextAfter: input.contextAfter,
        },
        resolveTelemetry(),
      )
    },
  })

  const readMarkdownTool = createTool({
    id: 'readMarkdown',
    description: 'Reads a slice of a markdown file stored for the user.',
    inputSchema: markdownReadSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: z.infer<typeof markdownReadSchema>
      runtime?: ToolRuntime
    }) => {
      const input = markdownReadSchema.parse(context)
      return markdownReadImpl({
        userId: resolveUser(runtime),
        path: input.path,
        offset: input.offset,
        limit: input.limit,
      })
    },
  })

  const listSessionsTool = createTool({
    id: 'listSessions',
    description: 'Lists recent therapy sessions ordered by start time.',
    inputSchema: sessionListSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: z.infer<typeof sessionListSchema>
      runtime?: ToolRuntime
    }) => {
      const input = sessionListSchema.parse(context)
      return sessionListImpl(
        {
          userId: resolveUser(runtime),
          lookbackDays: input.lookbackDays,
          limit: input.limit,
        },
        { telemetry: resolveTelemetry() },
      )
    },
  })

  const searchSessionsTool = createTool({
    id: 'searchSessions',
    description: 'Searches session summaries or transcript messages for a query.',
    inputSchema: sessionSearchSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: z.infer<typeof sessionSearchSchema>
      runtime?: ToolRuntime
    }) => {
      const input = sessionSearchSchema.parse(context)
      return sessionSearchImpl(
        {
          userId: resolveUser(runtime),
          query: input.query,
          lookbackDays: input.lookbackDays,
          limit: input.limit,
          fields: input.fields,
        },
        { telemetry: resolveTelemetry() },
      )
    },
  })

  const getSessionDetailTool = createTool({
    id: 'getSessionDetail',
    description: 'Retrieves paginated session transcript detail for evidence gathering.',
    inputSchema: sessionDetailSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof sessionDetailSchema>; runtime?: ToolRuntime }) => {
      const input = sessionDetailSchema.parse(context)
      return sessionDetailImpl(
        {
          userId: resolveUser(runtime),
          sessionId: input.sessionId,
          page: input.page,
          pageSize: input.pageSize,
        },
        { telemetry: resolveTelemetry() },
      )
    },
  })

  const listCheckInsTool = createTool({
    id: 'listCheckIns',
    description: 'Lists recent check-ins with intention and reflection summaries.',
    inputSchema: checkInListSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof checkInListSchema>; runtime?: ToolRuntime }) => {
      const input = checkInListSchema.parse(context)
      return checkInListImpl(
        {
          userId: resolveUser(runtime),
          lookbackDays: input.lookbackDays,
          limit: input.limit,
        },
        { telemetry: resolveTelemetry() },
      )
    },
  })

  const searchCheckInsTool = createTool({
    id: 'searchCheckIns',
    description: 'Searches check-ins for matching reflections or gratitude notes.',
    inputSchema: checkInSearchSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof checkInSearchSchema>; runtime?: ToolRuntime }) => {
      const input = checkInSearchSchema.parse(context)
      return checkInSearchImpl(
        {
          userId: resolveUser(runtime),
          query: input.query,
          lookbackDays: input.lookbackDays,
          limit: input.limit,
        },
        { telemetry: resolveTelemetry() },
      )
    },
  })

  const getCheckInDetailTool = createTool({
    id: 'getCheckInDetail',
    description: 'Retrieves the full detail for a specific check-in entry.',
    inputSchema: checkInDetailSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof checkInDetailSchema>; runtime?: ToolRuntime }) => {
      const input = checkInDetailSchema.parse(context)
      return checkInDetailImpl(
        {
          userId: resolveUser(runtime),
          checkInId: input.checkInId,
        },
        { telemetry: resolveTelemetry() },
      )
    },
  })

  return {
    listMarkdown: listMarkdownTool,
    searchMarkdown: searchMarkdownTool,
    readMarkdown: readMarkdownTool,
    listSessions: listSessionsTool,
    searchSessions: searchSessionsTool,
    getSessionDetail: getSessionDetailTool,
    listCheckIns: listCheckInsTool,
    searchCheckIns: searchCheckInsTool,
    getCheckInDetail: getCheckInDetailTool,
  }
}

export type ObservationResearchTools = ReturnType<typeof createObservationResearchTools>

function resolveToolUserId(baseUserId: string | null, runtime?: ToolRuntime): string {
  return resolveUserId(runtime?.userId ?? baseUserId ?? undefined)
}

function createDefaultTelemetryClient(): ObservationTelemetryClient | null {
  if (process.env.NODE_ENV === 'test') {
    return null
  }
  return createObservationTelemetryClient()
}
