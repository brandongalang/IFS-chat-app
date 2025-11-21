import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getUserClient, getServiceClient } from '@/lib/supabase/clients'
import { getSupabaseServiceRoleKey } from '@/lib/supabase/config'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { createInboxObservationAgent } from '@/mastra/agents/inbox-observation'
import { runObservationEngine } from '@/lib/inbox/observation-engine'
import { logInboxTelemetry } from '@/lib/inbox/telemetry'
import { randomUUID } from 'node:crypto'

const requestSchema = z.object({
  userId: z.string().uuid().optional(),
})

const COOLDOWN_HOURS = 24

export async function POST(request: NextRequest) {
  // 1) Use user client strictly for auth
  const userSupabase = getUserClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  let userId: string
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse('Invalid request body', HTTP_STATUS.BAD_REQUEST)
    }
    userId = parsed.data.userId ?? user.id
  } catch {
    return errorResponse('Failed to parse request body', HTTP_STATUS.BAD_REQUEST)
  }

  // 2) Preserve cross-user service-role authorization logic
  if (userId !== user.id) {
    const isServiceRole =
      user.app_metadata?.service_role === true ||
      user.app_metadata?.roles?.includes('service_role') ||
      user.role === 'service_role'

    if (!isServiceRole) {
      return errorResponse('Forbidden', HTTP_STATUS.FORBIDDEN)
    }
  }

  // 3) Guard: ensure service-role key exists for DB writes (RLS requires service_role for inserts)
  const serviceKey = getSupabaseServiceRoleKey()
  if (!serviceKey) {
    const message =
      'Service role key missing on server; manual generation requires SUPABASE_SERVICE_ROLE_KEY (RLS insert).'
    // In non-prod, return actionable message; in prod, keep generic 500
    const errMsg = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message
    return errorResponse(errMsg, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  // 4) Check 24-hour cooldown
  const admin = getServiceClient()
  const cooldownDate = new Date()
  cooldownDate.setHours(cooldownDate.getHours() - COOLDOWN_HOURS)

  const { data: recentGenerations } = await admin
    .from('inbox_items')
    .select('created_at')
    .eq('user_id', userId)
    .eq('metadata->>trigger', 'manual')
    .gte('created_at', cooldownDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (recentGenerations && recentGenerations.length > 0) {
    return errorResponse(
      'Manual generation cooldown active. Please wait 24 hours between manual syncs.',
      HTTP_STATUS.TOO_MANY_REQUESTS,
    )
  }

  const runId = randomUUID()
  const startedAt = Date.now()

  // Log start of manual generation
  await logInboxTelemetry(admin, {
    userId,
    tool: 'inbox_manual_generate.start',
    metadata: { runId, route: 'POST /api/inbox/generate' },
  })

  try {
    // 5) Use service-role client for all DB work inside the engine
    const agent = createInboxObservationAgent({ userId })
    const result = await runObservationEngine({
      supabase: admin,
      agent,
      userId,
      queueLimit: 5,
      dedupeWindowDays: 14,
      metadata: {
        trigger: 'manual',
        source: 'api',
        runId,
      },
      telemetry: { enabled: true, runId },
    })

    const durationMs = Date.now() - startedAt

    // Log success/skip with summary
    await logInboxTelemetry(admin, {
      userId,
      tool: 'inbox_manual_generate.result',
      durationMs,
      metadata: {
        runId,
        status: result.status,
        reason: result.reason ?? null,
        insertedCount: result.inserted.length,
        historyCount: result.historyCount,
        queue: {
          total: result.queue.total,
          available: result.queue.available,
          limit: result.queue.limit,
          hasCapacity: result.queue.hasCapacity,
        },
      },
    })

    return jsonResponse({
      status: result.status,
      inserted: result.inserted,
      queueStatus: {
        total: result.queue.total,
        available: result.queue.available,
        limit: result.queue.limit,
        hasCapacity: result.queue.hasCapacity,
      },
      reason: result.reason,
      runId,
      durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    console.error('Failed to generate observations manually:', error)
    await logInboxTelemetry(admin, {
      userId,
      tool: 'inbox_manual_generate.error',
      durationMs,
      metadata: { runId },
      error: error instanceof Error ? error.message : String(error),
    })
    return errorResponse(
      'Failed to generate observations',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    )
  }
}
