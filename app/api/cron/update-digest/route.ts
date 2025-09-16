import { requireCronAuth } from '@/lib/api/cron-auth'
import { listUsersWithPendingUpdates } from '@/lib/memory/updates'
import { summarizePendingUpdatesForUser, type UpdateSummarizerResult } from '@/lib/memory/update-runner'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'

async function runUpdateDigest(): Promise<Response> {
  const users = await listUsersWithPendingUpdates()
  const results: Array<UpdateSummarizerResult | { userId: string; error: string }> = []

  for (const userId of users) {
    try {
      const outcome = await summarizePendingUpdatesForUser(userId)
      results.push(outcome)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown-error'
      results.push({ userId, error: message })
    }
  }

  return jsonResponse({ processed: users.length, results })
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  try {
    return await runUpdateDigest()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Error'
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

export async function POST(req: Request) {
  if (!requireCronAuth(req)) return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  try {
    return await runUpdateDigest()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Error'
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
