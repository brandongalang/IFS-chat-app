import { requireCronAuth } from '@/lib/api/cron-auth'
import { finalizeStaleSessions } from '@/lib/memory/service'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'

/**
 * Hourly cron job to finalize stale sessions.
 * Closes sessions that have been idle for more than DEFAULT_IDLE_MINUTES.
 * Enqueues memory update jobs for sessions that are closed.
 * 
 * Replaces the broken memory-update cron that was dependent on user_memory_snapshots table.
 * 
 * @auth Requires CRON_SECRET header validation
 * @schedule Hourly (0 * * * *)
 */
async function runFinalizeSessionsCron(): Promise<Response> {
  try {
    const outcome = await finalizeStaleSessions()
    return jsonResponse({
      success: true,
      message: 'Sessions finalization completed',
      closed: outcome.closed,
      enqueued: outcome.enqueued,
      sessionIds: outcome.sessionIds,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Error'
    console.error('[CRON] finalize-sessions execution failed', { error: message })
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

export const dynamic = 'force-dynamic' // Prevents caching

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron-secret')
  console.log('[CRON] finalize-sessions auth check', {
    authPresent: !!authHeader,
    authStart: authHeader?.substring(0, 20) + '...',
    cronPresent: !!cronHeader,
    cronStart: cronHeader?.substring(0, 15) + '...',
    envHasCronSecret: !!process.env.CRON_SECRET,
    envCronSecretLength: process.env.CRON_SECRET?.length || 0,
  })

  if (!requireCronAuth(req)) {
    console.log('[CRON] finalize-sessions auth FAILED')
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  console.log('[CRON] finalize-sessions auth PASSED')
  return runFinalizeSessionsCron()
}

export async function POST(req: Request) {
  if (!requireCronAuth(req)) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }
  return runFinalizeSessionsCron()
}
