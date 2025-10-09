import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { listUnprocessedUpdates } from '@/lib/memory/service'

const listUnprocessedUpdatesSchema = z
  .object({})
  .strict()

export type ListUnprocessedUpdatesInput = z.infer<typeof listUnprocessedUpdatesSchema>

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

  return {
    listUnprocessedUpdates: listUnprocessedUpdatesTool,
  }
}

export type UpdateSyncTools = ReturnType<typeof createUpdateSyncTools>
