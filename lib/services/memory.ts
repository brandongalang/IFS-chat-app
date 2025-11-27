import { isMemoryV2Enabled } from '@/lib/memory/config'
import logger from '@/lib/logger';
import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold'
import { listUsersWithPendingUpdates } from '@/lib/memory/updates'
import { summarizePendingUpdatesForUser } from '@/lib/memory/update-runner'

export async function scaffoldUserMemory(opts: { userId: string }): Promise<void> {
  const userId = opts?.userId
  if (!userId) return
  if (!isMemoryV2Enabled()) return

  try {
    await ensureOverviewExists(userId)
  } catch (error) {
    logger.warn({ userId, error }, '[MEMORY] scaffoldUserMemory failed');
  }
}

interface SummarizePendingUpdatesOptions {
  userId?: string
  limit?: number
}

export async function summarizePendingUpdates(opts: SummarizePendingUpdatesOptions = {}): Promise<{ processed: number }> {
  if (!isMemoryV2Enabled()) return { processed: 0 }

  const userIds = opts.userId ? [opts.userId] : await listUsersWithPendingUpdates()
  if (!userIds.length) return { processed: 0 }

  const limit = opts.limit
  let processed = 0

  for (const userId of userIds) {
    try {
      await scaffoldUserMemory({ userId })
      const outcome = await summarizePendingUpdatesForUser(userId, limit ? { limit } : undefined)
      if (!outcome.skipped && outcome.itemCount > 0) {
        processed += outcome.itemCount
        logger.info({
          userId,
          processed: outcome.itemCount,
          digest: outcome.digest,
        }, '[MEMORY] Summarized pending updates');
      }
    } catch (error) {
      logger.warn({ userId, error }, '[MEMORY] summarizePendingUpdates failed');
    }
  }

  return { processed }
}
