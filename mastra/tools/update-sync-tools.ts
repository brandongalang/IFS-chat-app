import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { listUnprocessedUpdates, markUpdatesProcessed } from '@/lib/memory/service'

const listUnprocessedUpdatesSchema = z
  .object({})
  .strict()

export type ListUnprocessedUpdatesInput = z.infer<typeof listUnprocessedUpdatesSchema>

const markUpdatesProcessedSchema = z
  .object({
    sessionIds: z.array(z.string().uuid()).default([]),
    insightIds: z.array(z.string().uuid()).default([]),
    checkInIds: z.array(z.string().uuid()).default([]),
  })
  .strict()

type UnprocessedUpdates = Awaited<ReturnType<typeof listUnprocessedUpdates>>

type ListUnprocessedUpdatesToolResult = UnprocessedUpdates & {
  totals: {
    sessions: number
    insights: number
    checkIns: number
    overall: number
  }
  success: boolean
  error?: string
}

function createEmptyResult(error?: string): ListUnprocessedUpdatesToolResult {
  return {
    sessions: [],
    insights: [],
    checkIns: [],
    totals: {
      sessions: 0,
      insights: 0,
      checkIns: 0,
      overall: 0,
    },
    success: false,
    ...(error ? { error } : {}),
  }
}

function toUserFacingMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message || fallback
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error
  }
  return fallback
}

export function createUpdateSyncTools(userId?: string) {
  const listUnprocessedUpdatesTool = createTool({
    id: 'listUnprocessedUpdates',
    description:
      "Fetches the user's unprocessed sessions, insights, and check-ins so the agent can sync memory updates.",
    inputSchema: listUnprocessedUpdatesSchema,
    execute: async ({ context, runtime }: { context: ListUnprocessedUpdatesInput; runtime?: { userId?: string } }) => {
      listUnprocessedUpdatesSchema.parse(context)
      let resolvedUserId: string
      try {
        resolvedUserId = resolveUserId(runtime?.userId ?? userId)
      } catch (error) {
        const message = toUserFacingMessage(
          error,
          'Could not determine which user profile to sync. Please sign in again.'
        )
        console.warn('[UpdateSyncTools] Missing userId for listUnprocessedUpdates', {
          providedUserId: userId,
          runtimeUserId: runtime?.userId,
          error: message,
        })
        return createEmptyResult(message)
      }

      try {
        const updates = await listUnprocessedUpdates(resolvedUserId)
        return {
          ...updates,
          totals: {
            sessions: updates.sessions.length,
            insights: updates.insights.length,
            checkIns: updates.checkIns.length,
            overall: updates.sessions.length + updates.insights.length + updates.checkIns.length,
          },
          success: true,
        } satisfies ListUnprocessedUpdatesToolResult
      } catch (error) {
        const message = toUserFacingMessage(
          error,
          'Unable to load unprocessed updates from Supabase right now.'
        )
        console.error('[UpdateSyncTools] listUnprocessedUpdates failed', {
          userId: resolvedUserId,
          error: message,
        })
        return createEmptyResult(message)
      }
    },
  })

  const markUpdatesProcessedTool = createTool({
    id: 'markUpdatesProcessed',
    description: 'Marks sessions, insights, and check-ins as processed after memory updates are written.',
    inputSchema: markUpdatesProcessedSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof markUpdatesProcessedSchema>; runtime?: { userId?: string } }) => {
      const input = markUpdatesProcessedSchema.parse(context)
      let resolvedUserId: string
      try {
        resolvedUserId = resolveUserId(runtime?.userId ?? userId)
      } catch (error) {
        const message = toUserFacingMessage(
          error,
          'Could not determine which user profile to mark processed.'
        )
        console.warn('[UpdateSyncTools] Missing userId for markUpdatesProcessed', {
          providedUserId: userId,
          runtimeUserId: runtime?.userId,
          error: message,
        })
        return {
          success: false as const,
          error: message,
        }
      }

      try {
        await markUpdatesProcessed(resolvedUserId, {
          sessions: input.sessionIds.map((id) => ({ id })),
          insights: input.insightIds.map((id) => ({ id })),
          checkIns: input.checkInIds.map((id) => ({ id })),
        })

        return {
          success: true as const,
          processed: {
            sessions: input.sessionIds.length,
            insights: input.insightIds.length,
            checkIns: input.checkInIds.length,
            overall: input.sessionIds.length + input.insightIds.length + input.checkInIds.length,
          },
        }
      } catch (error) {
        const message = toUserFacingMessage(
          error,
          'Unable to mark updates as processed right now.'
        )
        console.error('[UpdateSyncTools] markUpdatesProcessed failed', {
          userId: resolvedUserId,
          error: message,
        })
        return {
          success: false as const,
          error: message,
        }
      }
    },
  })

  return {
    listUnprocessedUpdates: listUnprocessedUpdatesTool,
    markUpdatesProcessed: markUpdatesProcessedTool,
  }
}

export type UpdateSyncTools = ReturnType<typeof createUpdateSyncTools>
