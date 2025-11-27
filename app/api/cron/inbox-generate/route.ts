import { randomUUID } from 'node:crypto'
import { requireCronAuth } from '@/lib/api/cron-auth'
import { getServiceClient } from '@/lib/supabase/clients'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { createUnifiedInboxAgent } from '@/mastra/agents/unified-inbox'
import { runUnifiedInboxEngine } from '@/lib/inbox/unified-inbox-engine'

/**
 * Daily cron job to generate inbox items for active users.
 * Runs the unified inbox engine for each user with recent activity.
 *
 * @auth Requires CRON_SECRET header validation
 * @schedule Daily (0 8 * * *) - 8 AM UTC
 */

const MAX_USERS_PER_RUN = 50
const QUEUE_LIMIT = 5
const DEDUPE_WINDOW_DAYS = 14

interface UserResult {
  userId: string
  status: 'success' | 'skipped' | 'error'
  insertedCount: number
  reason?: string
}

async function getActiveUserIds(supabase: ReturnType<typeof getServiceClient>): Promise<string[]> {
  // Get users who have had activity in the last 7 days
  // This includes chat sessions, check-ins, or other interactions
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('user_id')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[CRON] inbox-generate: Failed to fetch active users', error)
    return []
  }

  // Dedupe user IDs
  const uniqueUserIds = [...new Set((data ?? []).map((row) => row.user_id))]
  return uniqueUserIds.slice(0, MAX_USERS_PER_RUN)
}

async function runInboxGenerateCron(): Promise<Response> {
  const runId = randomUUID()
  const startedAt = Date.now()

  const supabase = getServiceClient()

  try {
    // Get active users
    const userIds = await getActiveUserIds(supabase)

    if (userIds.length === 0) {
      console.log('[CRON] inbox-generate: No active users found')
      return jsonResponse({
        success: true,
        message: 'No active users to process',
        runId,
        processedCount: 0,
        results: [],
      })
    }

    console.log(`[CRON] inbox-generate: Processing ${userIds.length} users`, { runId })

    // Record job start
    const { data: jobRun } = await supabase
      .from('inbox_job_runs')
      .insert({
        job_name: 'inbox_generate_cron',
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: {
          runId,
          userCount: userIds.length,
          trigger: 'cron',
        },
      })
      .select('id')
      .single()

    const jobRunId = jobRun?.id

    const results: UserResult[] = []
    let successCount = 0
    let skippedCount = 0
    let errorCount = 0

    // Process each user
    for (const userId of userIds) {
      try {
        const agent = createUnifiedInboxAgent({ userId }, { runId })
        const result = await runUnifiedInboxEngine({
          supabase,
          agent,
          userId,
          queueLimit: QUEUE_LIMIT,
          dedupeWindowDays: DEDUPE_WINDOW_DAYS,
          metadata: {
            trigger: 'cron',
            source: 'vercel_cron',
            runId,
            jobRunId,
          },
          telemetry: { enabled: true, runId },
        })

        results.push({
          userId,
          status: result.status,
          insertedCount: result.inserted.length,
          reason: result.reason,
        })

        if (result.status === 'success') successCount++
        else if (result.status === 'skipped') skippedCount++
        else errorCount++

      } catch (error) {
        errorCount++
        results.push({
          userId,
          status: 'error',
          insertedCount: 0,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
        console.error(`[CRON] inbox-generate: Error for user ${userId}`, error)
      }
    }

    const durationMs = Date.now() - startedAt

    // Update job run record
    if (jobRunId) {
      await supabase
        .from('inbox_job_runs')
        .update({
          status: errorCount > 0 ? 'failed' : 'success',
          finished_at: new Date().toISOString(),
          metadata: {
            runId,
            userCount: userIds.length,
            trigger: 'cron',
            successCount,
            skippedCount,
            errorCount,
            durationMs,
          },
        })
        .eq('id', jobRunId)
    }

    console.log('[CRON] inbox-generate: Completed', {
      runId,
      successCount,
      skippedCount,
      errorCount,
      durationMs,
    })

    return jsonResponse({
      success: true,
      message: 'Inbox generation completed',
      runId,
      processedCount: userIds.length,
      successCount,
      skippedCount,
      errorCount,
      durationMs,
      results,
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Error'
    console.error('[CRON] inbox-generate: Execution failed', { error: message, runId })
    return errorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for processing multiple users

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron-secret')
  console.log('[CRON] inbox-generate auth check', {
    authPresent: !!authHeader,
    authStart: authHeader?.substring(0, 20) + '...',
    cronPresent: !!cronHeader,
    cronStart: cronHeader?.substring(0, 15) + '...',
    envHasCronSecret: !!process.env.CRON_SECRET,
  })

  if (!requireCronAuth(req)) {
    console.log('[CRON] inbox-generate auth FAILED')
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  console.log('[CRON] inbox-generate auth PASSED')
  return runInboxGenerateCron()
}

export async function POST(req: Request) {
  if (!requireCronAuth(req)) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }
  return runInboxGenerateCron()
}
