#!/usr/bin/env tsx
import path from 'node:path'
import process from 'node:process'

// Bypass server-only check for script execution
process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

import { config as loadEnv } from 'dotenv'

import { createUnifiedInboxAgent } from '@/mastra/agents/unified-inbox'
import { runUnifiedInboxEngine } from '@/lib/inbox/unified-inbox-engine'
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

  console.log(`Starting unified inbox generation for ${userIds.length} users...`)

  for (const userId of userIds) {
    try {
      // Pass useServiceRole: true to agent config for background execution
      const agent = createUnifiedInboxAgent({ userId }, { useServiceRole: true })

      const result = await runUnifiedInboxEngine({
        supabase,
        agent,
        userId,
        queueLimit,
        dedupeWindowDays,
        metadata: {
          trigger: 'script',
          source: 'cli',
        },
      })

      console.log(
        `• ${userId}: ${result.status} (inserted=${result.inserted.length}, reason=${result.reason ?? 'n/a'})`,
      )
      if (result.status === 'error' && result.error) {
        console.error(`  Error: ${result.error.message}`)
      }
    } catch (error) {
      console.error(`• ${userId}: crashed`)
      console.error(error)
    }
  }
}

void main()
