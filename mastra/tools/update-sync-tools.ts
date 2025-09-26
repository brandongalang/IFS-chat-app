import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { listUnprocessedUpdates } from '@/lib/memory/service'

const listUnprocessedUpdatesSchema = z
  .object({})
  .strict()

export type ListUnprocessedUpdatesInput = z.infer<typeof listUnprocessedUpdatesSchema>

export function createUpdateSyncTools(userId?: string) {
  const listUnprocessedUpdatesTool = createTool({
    id: 'listUnprocessedUpdates',
    description:
      "Fetches the user's unprocessed sessions, insights, and check-ins so the agent can sync memory updates.",
    inputSchema: listUnprocessedUpdatesSchema,
    execute: async ({ context, runtime }: { context: ListUnprocessedUpdatesInput; runtime?: { userId?: string } }) => {
      listUnprocessedUpdatesSchema.parse(context)
      const resolvedUserId = resolveUserId(runtime?.userId ?? userId)
      const updates = await listUnprocessedUpdates(resolvedUserId)

      return {
        ...updates,
        totals: {
          sessions: updates.sessions.length,
          insights: updates.insights.length,
          checkIns: updates.checkIns.length,
          overall: updates.sessions.length + updates.insights.length + updates.checkIns.length,
        },
      }
    },
  })

  return {
    listUnprocessedUpdates: listUnprocessedUpdatesTool,
  }
}

export type UpdateSyncTools = ReturnType<typeof createUpdateSyncTools>
