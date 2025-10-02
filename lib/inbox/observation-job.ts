import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'
import type { InboxObservationAgent } from '@/mastra/agents/inbox-observation'
import { runObservationEngine, type ObservationEngineResult } from './observation-engine'

type Supabase = SupabaseClient<Database>

export interface ObservationJobOptions {
  supabase: Supabase
  agentFactory: (userId: string) => InboxObservationAgent
  userIds: string[]
  queueLimit?: number
  dedupeWindowDays?: number
  jobName?: string
  now?: Date
  metadata?: Record<string, unknown>
}

export interface ObservationJobUserResult extends ObservationEngineResult {
  userId: string
}

export interface ObservationJobRunResult {
  jobRunId: string
  startedAt: string
  finishedAt: string
  results: ObservationJobUserResult[]
}

const DEFAULT_JOB_NAME = 'inbox_observation_daily'

export async function runObservationJob(options: ObservationJobOptions): Promise<ObservationJobRunResult> {
  const { supabase } = options
  const userIds = Array.isArray(options.userIds) ? options.userIds : []
  if (!userIds.length) {
    throw new Error('No user IDs provided for observation job')
  }

  const now = options.now ?? new Date()
  const jobName = options.jobName ?? DEFAULT_JOB_NAME

  const jobRunId = await startJobRun(supabase, {
    jobName,
    startedAt: now,
    metadata: {
      userCount: userIds.length,
      queueLimit: options.queueLimit ?? null,
      dedupeWindowDays: options.dedupeWindowDays ?? null,
      ...(options.metadata ?? {}),
    },
  })

  const results: ObservationJobUserResult[] = []
  let successCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const userId of userIds) {
    try {
      const agent = options.agentFactory(userId)
      const result = await runObservationEngine({
        supabase,
        agent,
        userId,
        queueLimit: options.queueLimit,
        dedupeWindowDays: options.dedupeWindowDays,
        now,
        metadata: {
          jobRunId,
          jobName,
        },
      })

      results.push({ ...result, userId })

      if (result.status === 'success') successCount += 1
      else if (result.status === 'skipped') skippedCount += 1
      else errorCount += 1
    } catch (error) {
      errorCount += 1
      results.push({
        userId,
        status: 'error',
        queue: {
          total: 0,
          available: options.queueLimit ?? 3,
          limit: options.queueLimit ?? 3,
          hasCapacity: true,
        },
        inserted: [],
        historyCount: 0,
        reason: 'engine_exception',
        error: error instanceof Error ? error : new Error('Unknown engine error'),
      })
    }
  }

  const finishedAt = new Date()

  await completeJobRun(supabase, {
    jobRunId,
    finishedAt,
    status: errorCount > 0 ? 'failed' : 'success',
    metadata: {
      userCount: userIds.length,
      queueLimit: options.queueLimit ?? null,
      dedupeWindowDays: options.dedupeWindowDays ?? null,
      ...(options.metadata ?? {}),
      successCount,
      skippedCount,
      errorCount,
      processedUserIds: userIds,
    },
  })

  return {
    jobRunId,
    startedAt: now.toISOString(),
    finishedAt: finishedAt.toISOString(),
    results,
  }
}

interface StartJobInput {
  jobName: string
  startedAt: Date
  metadata?: Record<string, unknown>
}

async function startJobRun(supabase: Supabase, input: StartJobInput): Promise<string> {
  const { data, error } = await supabase
    .from('inbox_job_runs')
    .insert({
      job_name: input.jobName,
      status: 'running',
      started_at: input.startedAt.toISOString(),
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single()

  if (error || !data) {
    throw error ?? new Error('Failed to start job run')
  }

  return data.id
}

interface CompleteJobInput {
  jobRunId: string
  status: 'success' | 'failed'
  finishedAt: Date
  metadata?: Record<string, unknown>
  error?: unknown
}

async function completeJobRun(supabase: Supabase, input: CompleteJobInput): Promise<void> {
  const payload: Record<string, unknown> = {
    status: input.status,
    finished_at: input.finishedAt.toISOString(),
  }

  if (input.metadata) {
    payload.metadata = input.metadata
  }

  if (input.error) {
    payload.error = serializeError(input.error)
  }

  const { error } = await supabase
    .from('inbox_job_runs')
    .update(payload)
    .eq('id', input.jobRunId)

  if (error) {
    throw error
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown error',
  }
}
