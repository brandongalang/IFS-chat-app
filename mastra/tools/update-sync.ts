import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { fetchPendingUpdates } from '@/lib/memory/updates'

const updateSyncInputSchema = z
  .object({
    userId: z.string().uuid().optional().describe('User ID whose pending updates should be retrieved.'),
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

type UpdateSyncRuntime = {
  userId?: string
}

function createUpdateSyncTool(defaultUserId?: string) {
  return createTool({
    id: 'updateSync',
    description: 'Fetches outstanding memory updates that have not yet been summarized. Use before crafting a digest.',
    inputSchema: updateSyncInputSchema,
    execute: async ({ context, runtime }: { context: UpdateSyncInput; runtime?: UpdateSyncRuntime }) => {
      const input = updateSyncInputSchema.parse(context)
      const resolvedUserId = resolveUserId(input.userId ?? runtime?.userId ?? defaultUserId)
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
}

export function createPendingUpdateTools(userId?: string) {
  const updateSync = createUpdateSyncTool(userId)

  return {
    updateSync,
  }
}

export const updateSyncTools = createPendingUpdateTools()

export type UpdateSyncTools = ReturnType<typeof createPendingUpdateTools>
