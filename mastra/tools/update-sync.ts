import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { fetchPendingUpdates } from '@/lib/memory/updates'

const updateSyncInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Maximum number of updates to return.'),
  })
  .strict()

export type UpdateSyncInput = z.infer<typeof updateSyncInputSchema>

export function createPendingUpdateTools(userId?: string) {
  const updateSyncTool = createTool({
    id: 'updateSync',
    description: 'Fetches outstanding memory updates that have not yet been summarized. Use before crafting a digest.',
    inputSchema: updateSyncInputSchema,
    execute: async ({ context, runtime }: { context: UpdateSyncInput; runtime?: { userId?: string } }) => {
      const input = updateSyncInputSchema.parse(context)
      const resolvedUserId = resolveUserId(runtime?.userId ?? userId)
      const updates = await fetchPendingUpdates(resolvedUserId, input.limit)
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

  return {
    updateSync: updateSyncTool,
  }
}

export type UpdateSyncTools = ReturnType<typeof createPendingUpdateTools>
