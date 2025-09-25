import 'server-only'

import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { fetchPendingUpdates } from '@/lib/memory/updates'

const updateSyncInputSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID whose pending updates should be retrieved.'),
  limit: z.number().int().min(1).max(50).default(20).describe('Maximum number of updates to return.'),
})

export const updateSyncTool = createTool({
  id: 'updateSync',
  description: 'Fetches outstanding memory updates that have not yet been summarized. Use before crafting a digest.',
  inputSchema: updateSyncInputSchema,
  execute: async ({ context }) => {
    const input = updateSyncInputSchema.parse(context)
    const userId = resolveUserId(input.userId)
    const updates = await fetchPendingUpdates(userId, input.limit)
    return updates.map((update) => ({
      id: update.id,
      kind: update.kind,
      summary: update.summary,
      createdAt: update.createdAt,
      payload: update.payload,
      metadata: update.metadata,
    }))
  },
})

export const updateSyncTools = {
  updateSync: updateSyncTool,
}

