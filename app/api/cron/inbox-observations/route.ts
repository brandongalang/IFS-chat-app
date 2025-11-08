import { requireCronAuth } from '@/lib/api/cron-auth'
import { jsonResponse, errorResponse, HTTP_STATUS } from '@/lib/api/response'
import { getServiceClient } from '@/lib/supabase/clients'
import { createInboxObservationAgent } from '@/mastra/agents/inbox-observation'
import { runObservationEngine } from '@/lib/inbox/observation-engine'

interface CronResult {
  userId: string
  observationsGenerated?: number
  observationsSkipped?: boolean
  error?: string
}

async function runDailyInboxObservations(): Promise<Response> {
  const supabase = getServiceClient()
  const startTime = Date.now()

  // Fetch all active users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id')

  if (usersError) {
    console.error('[CRON:inbox] Error fetching users:', usersError)
    return errorResponse('Failed to fetch users', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  if (!users || users.length === 0) {
    console.log('[CRON:inbox] No users found')
    return jsonResponse({
      message: 'Daily inbox observation generation job completed',
      processedUserCount: 0,
      totalObservationsGenerated: 0,
      durationMs: Date.now() - startTime,
    })
  }

  let totalObservationsGenerated = 0
  let usersSkipped = 0
  const results: CronResult[] = []

  for (const user of users) {
    const userId = user.id
    const runId = `cron-${Date.now()}-${userId.substring(0, 8)}`

    try {
      console.log(`[CRON:inbox] Processing user ${userId}`)

      // Create agent for this user
      const agent = createInboxObservationAgent(
        { userId },
        { requestId: runId, runId }
      )

      // Run observation engine for this user
      const result = await runObservationEngine(
        {
          supabase,
          agent,
          userId,
          queueLimit: 3, // Keep conservative limit for cron
          dedupeWindowDays: 14,
          metadata: {
            trigger: 'daily-cron',
            runId,
          },
          telemetry: {
            enabled: true,
            runId,
          },
        }
      )

      if (result.status === 'success') {
        const count = result.inserted.length
        totalObservationsGenerated += count
        results.push({
          userId,
          observationsGenerated: count,
        })
        console.log(`[CRON:inbox] Generated ${count} observations for user ${userId}`)
      } else if (result.status === 'skipped') {
        usersSkipped++
        results.push({
          userId,
          observationsSkipped: true,
        })
        console.log(`[CRON:inbox] Skipped user ${userId}: ${result.reason}`)
      } else if (result.status === 'error') {
        results.push({
          userId,
          error: result.reason || 'unknown-error',
        })
        console.error(`[CRON:inbox] Error for user ${userId}: ${result.reason}`)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown-error'
      results.push({
        userId,
        error: message,
      })
      console.error(`[CRON:inbox] Exception for user ${userId}:`, error)
    }
  }

  const durationMs = Date.now() - startTime

  const summary = {
    message: 'Daily inbox observation generation job completed',
    processedUserCount: users.length,
    usersWithObservations: results.filter(r => r.observationsGenerated).length,
    usersSkipped,
    totalObservationsGenerated,
    durationMs,
    results: results.slice(0, 10), // Return first 10 results for logging
  }

  console.log('[CRON:inbox] Job finished', summary)
  return jsonResponse(summary)
}

export const dynamic = 'force-dynamic' // Prevents caching

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-vercel-cron-secret')

  console.log('[CRON:inbox] Auth check', {
    authPresent: !!authHeader,
    authStart: authHeader?.substring(0, 20) + '...',
    cronPresent: !!cronHeader,
    cronStart: cronHeader?.substring(0, 15) + '...',
    envHasCronSecret: !!process.env.CRON_SECRET,
    envCronSecretLength: process.env.CRON_SECRET?.length || 0,
  })

  if (!requireCronAuth(request)) {
    console.log('[CRON:inbox] Auth FAILED')
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  console.log('[CRON:inbox] Auth PASSED, starting job')

  try {
    return await runDailyInboxObservations()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error'
    console.error('[CRON:inbox] Execution failed:', error)
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

export async function POST(request: Request) {
  if (!requireCronAuth(request)) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  try {
    return await runDailyInboxObservations()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error'
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
