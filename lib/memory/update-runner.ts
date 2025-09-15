import type { CoreMessage } from 'ai'
import { createUpdateSummarizerAgent, updateDigestSchema, type UpdateDigest } from '@/mastra/agents/update-summarizer'
import { fetchPendingUpdates, markUpdatesProcessed, type MemoryUpdateRecord } from '@/lib/memory/updates'
import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold'
import { userOverviewPath } from '@/lib/memory/snapshots/fs-helpers'
import { appendChangeLogWithEvent } from '@/lib/memory/snapshots/updater'

export interface UpdateSummarizerResult {
  userId: string
  processedIds: string[]
  digest?: string
  itemCount: number
  skipped: boolean
  reason?: string
  raw?: UpdateDigest
}

function buildPrompt(userId: string): CoreMessage[] {
  return [
    {
      role: 'user',
      content: `User ${userId} needs their pending memory updates summarized.
Call the updateSync tool with {"userId":"${userId}"} to retrieve outstanding items before writing anything.
Return JSON matching the provided schema only.`,
    },
  ]
}

function selectProcessedUpdates(pending: MemoryUpdateRecord[], digest: UpdateDigest | undefined) {
  if (!digest) return { processed: [] as Array<{ id: string; summary?: string | null }> }
  const pendingIds = new Set(pending.map((item) => item.id))
  const processed = (digest.items || [])
    .filter((item) => pendingIds.has(item.id))
    .map((item) => ({ id: item.id, summary: item.summary }))
  return { processed }
}

export async function summarizePendingUpdatesForUser(userId: string, opts: { limit?: number } = {}): Promise<UpdateSummarizerResult> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason: 'openrouter-missing' }
  }

  const pending = await fetchPendingUpdates(userId, opts.limit ?? 25)
  if (!pending.length) {
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason: 'no-updates' }
  }

  const summarizer = createUpdateSummarizerAgent()
  const model = await summarizer.getModel({})

  const result = await summarizer.generate(buildPrompt(userId), {
    structuredOutput: {
      schema: updateDigestSchema,
      model,
      errorStrategy: 'strict',
    },
    toolChoice: 'auto',
  })

  const digest = result.object as UpdateDigest | undefined

  if (!digest) {
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason: 'no-digest' }
  }

  const { processed } = selectProcessedUpdates(pending, digest)
  if (!processed.length) {
    return { userId, processedIds: [], digest: digest.digest, itemCount: 0, skipped: true, reason: 'no-matching-updates', raw: digest }
  }

  await ensureOverviewExists(userId)
  const overviewPath = userOverviewPath(userId)
  const trimmedDigest = digest.digest.trim()
  if (trimmedDigest) {
    await appendChangeLogWithEvent({
      userId,
      entityType: 'user',
      entityId: userId,
      filePath: overviewPath,
      line: trimmedDigest,
    })
  }

  await markUpdatesProcessed({ userId, updates: processed, digest: trimmedDigest })

  return {
    userId,
    processedIds: processed.map((p) => p.id),
    digest: trimmedDigest || undefined,
    itemCount: processed.length,
    skipped: false,
    raw: digest,
  }
}

