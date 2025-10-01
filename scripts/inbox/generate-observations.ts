#!/usr/bin/env tsx
import path from 'node:path'
import process from 'node:process'

import { config as loadEnv } from 'dotenv'

import { createInboxObservationAgent } from '@/mastra/agents/inbox-observation'
import { runObservationJob } from '@/lib/inbox/observation-job'
import { getServiceClient } from '@/lib/supabase/clients'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

type ArgMap = Map<string, string | boolean>

function parseArguments(argv: string[]): ArgMap {
  const entries: Array<[string, string | boolean]> = []
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      entries.push([key, true])
      continue
    }
    entries.push([key, next])
    i += 1
  }
  return new Map(entries)
}

async function resolveUserIds(client = getServiceClient(), limit?: number): Promise<string[]> {
  const query = client
    .from('users')
    .select('id')
    .order('created_at', { ascending: true })

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map((row: { id: string }) => row.id)
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const userArg = args.get('user')
  const limitArg = args.get('limit')
  const queueArg = args.get('queue')
  const windowArg = args.get('window')

  const queueLimit = typeof queueArg === 'string' ? Number.parseInt(queueArg, 10) : undefined
  const dedupeWindowDays = typeof windowArg === 'string' ? Number.parseInt(windowArg, 10) : undefined
  const limit = typeof limitArg === 'string' ? Number.parseInt(limitArg, 10) : undefined

  const supabase = getServiceClient()
  const userIds = typeof userArg === 'string' && userArg
    ? [userArg]
    : await resolveUserIds(supabase, limit)

  if (!userIds.length) {
    console.error('No user IDs available for observation generation.')
    process.exit(1)
  }

  const agent = createInboxObservationAgent()

  try {
    const { jobRunId, results, startedAt, finishedAt } = await runObservationJob({
      supabase,
      agent,
      userIds,
      queueLimit,
      dedupeWindowDays,
      metadata: {
        invokedBy: 'cli',
        argv: process.argv.slice(2),
      },
    })

    console.log(`Observation job ${jobRunId} started ${startedAt} finished ${finishedAt}`)

    for (const result of results) {
      console.log(
        `• ${result.userId}: ${result.status} (inserted=${result.inserted.length}, reason=${result.reason ?? 'n/a'})`,
      )
    }
  } catch (error) {
    console.error('Failed to run inbox observation job.')
    console.error(error)
    process.exit(1)
  }
}

void main()
