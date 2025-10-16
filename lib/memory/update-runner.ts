import type { CoreMessage } from 'ai'
import type { Agent } from '@mastra/core'
import { getMastra } from '@/mastra'
import { updateDigestSchema, type UpdateDigest } from '@/mastra/agents/update-summarizer'
import { fetchPendingUpdates, markUpdatesProcessed, type MemoryUpdateRecord } from '@/lib/memory/updates'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function summarizePendingUpdatesForUser(
  userId: string,
  opts: { limit?: number } = {},
): Promise<UpdateSummarizerResult> {
  const pending = await fetchPendingUpdates(userId, opts.limit ?? 25)
  if (!pending.length) {
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason: 'no-updates' }
  }

  const mastra = getMastra()
  const summarizer = mastra.getAgent('updateSummarizerAgent') as Agent | undefined

  if (!summarizer) {
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason: 'summarizer-missing' }
  }

  type SummarizerModel = Awaited<ReturnType<Agent['getModel']>>
  type SummarizerResult = Awaited<ReturnType<Agent['generate']>>

  let model: SummarizerModel | undefined
  try {
    model = await summarizer.getModel({})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error'
    const reason = /openrouter/i.test(message) ? 'openrouter-missing' : 'model-error'
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason }
  }

  let result: SummarizerResult
  try {
    result = await summarizer.generate(buildPrompt(userId), {
      structuredOutput: {
        schema: updateDigestSchema,
        model,
        errorStrategy: 'strict',
      },
      toolChoice: 'auto',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error'
    const reason = /openrouter/i.test(message) ? 'openrouter-missing' : 'generation-error'
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason }
  }

  const digest = result.object as UpdateDigest | undefined

  if (!digest) {
    return { userId, processedIds: [], digest: undefined, itemCount: 0, skipped: true, reason: 'no-digest' }
  }

  const { processed } = selectProcessedUpdates(pending, digest)
  if (!processed.length) {
    return {
      userId,
      processedIds: [],
      digest: digest.digest,
      itemCount: 0,
      skipped: true,
      reason: 'no-matching-updates',
      raw: digest,
    }
  }

  const trimmedDigest = digest.digest.trim()

  if (trimmedDigest) {
    try {
      await recordUpdateDigest(userId, digest)
    } catch (error) {
      console.error('[UpdateRunner] Failed to persist update digest', {
        userId,
        error: error instanceof Error ? error.message : error,
      })
    }
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
async function recordUpdateDigest(userId: string, digest: UpdateDigest): Promise<void> {
  const trimmed = digest.digest.trim()
  if (!trimmed) return

  const supabase = createAdminClient()
  const payload = {
    user_id: userId,
    type: 'note',
    content: trimmed,
    metadata: {
      source: 'update-runner',
      items: digest.items ?? [],
      leftoverIds: digest.leftoverIds ?? [],
    },
    entities: [] as string[],
  }

  const { error } = await supabase.from('observations').insert(payload)
  if (error) {
    throw new Error(`Failed to record update digest: ${error.message}`)
  }
}
