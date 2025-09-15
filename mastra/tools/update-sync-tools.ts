import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { listUnprocessedUpdates } from '@/lib/memory/service'

const listUnprocessedUpdatesSchema = z.object({
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('User ID to fetch unprocessed updates for (optional in development mode).'),
})

export const listUnprocessedUpdatesTool = createTool({
  id: 'listUnprocessedUpdates',
  description:
    "Fetches the user's unprocessed sessions, insights, and check-ins so the agent can sync memory updates.",
  inputSchema: listUnprocessedUpdatesSchema,
  execute: async ({ context }) => {
    const input = listUnprocessedUpdatesSchema.parse(context)
    const userId = resolveUserId(input.userId)
    const updates = await listUnprocessedUpdates(userId)

    return {
      ...updates,
      totals: {
        sessions: updates.sessions.length,
        insights: updates.insights.length,
        checkIns: updates.checkIns.length,
        overall:
          updates.sessions.length + updates.insights.length + updates.checkIns.length,
      },
    }
  },
})

export const updateSyncTools = {
  listUnprocessedUpdates: listUnprocessedUpdatesTool,
}
