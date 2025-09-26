import { DAY_MS } from '@/config/time'
import { requireCronAuth } from '@/lib/api/cron-auth'
import { listActiveUsersSince, reconstructMemory, loadTodayData, generateMemoryUpdate, saveNewSnapshot, markUpdatesProcessed } from '@/lib/memory/service'
import { summarizePendingUpdates } from '@/lib/services/memory'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'

async function runDailyMemoryUpdate(): Promise<Response> {
  const cutoff = new Date(Date.now() - DAY_MS).toISOString()
  const users = await listActiveUsersSince(cutoff)

  const results: Array<{ userId: string; version?: number; error?: string }> = []

  for (const userId of users) {
    try {
      const previous = await reconstructMemory(userId)
      const today = await loadTodayData(userId, cutoff)
      // If no activity payloads found, skip to avoid bumping version unnecessarily
      if ((today.sessions?.length || 0) + (today.insights?.length || 0) === 0) {
        results.push({ userId, error: 'no-activity' })
        continue
      }
      const next = await generateMemoryUpdate({ userId, oldMemory: previous, todayData: today })
      const saved = await saveNewSnapshot({ userId, previous, next, source: 'cron-daily' })
      await markUpdatesProcessed(userId, today)
      results.push({ userId, version: saved.version })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown-error'
      results.push({ userId, error: message })
    }
  }

  const summaryOutcome = await summarizePendingUpdates()
  console.log('[CRON] summarizePendingUpdates outcome', summaryOutcome)

  return jsonResponse({ cutoff, processed: users.length, results, summaries: summaryOutcome.processed })
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  try {
    return await runDailyMemoryUpdate()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Error'
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

export async function POST(req: Request) {
  if (!requireCronAuth(req)) return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  try {
    return await runDailyMemoryUpdate()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Error'
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
