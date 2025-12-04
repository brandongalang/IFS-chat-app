import 'server-only'

import { z } from 'zod'
import logger from '@/lib/logger'
import { partCategoryEnum, partStatusEnum, type PartRowV2 } from './types'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import { getPartByIdV2, upsertPartV2 } from './parts'

/**
 * Input for syncing a part from markdown storage to the database
 */
export const markdownPartSyncInputSchema = z
  .object({
    partId: z.string().uuid(),
    name: z.string(),
    status: partStatusEnum,
    category: partCategoryEnum,
    role: z.string().optional(),
    evidence: z.array(z.string()).optional(),
    emoji: z.string().nullable().optional(),
  })
  .strict()

export type MarkdownPartSyncInput = z.infer<typeof markdownPartSyncInputSchema>

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry ?? '')))
    .filter((entry) => entry.length > 0)
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value === b[index])
}

/**
 * Dedicated PRD markdown sync helper.
 *
 * This function handles the logic of syncing a part profile read from markdown
 * into the parts_v2 database table. It handles merging with existing data,
 * conflict resolution for specific fields (preferring DB or Markdown depending on field),
 * and recording the sync metadata.
 */
export async function syncPartFromMarkdown(
  input: MarkdownPartSyncInput,
  deps: PrdDataDependencies
): Promise<PartRowV2> {
  const { client, userId } = assertPrdDeps(deps)
  const now = new Date().toISOString()

  // 1. Fetch existing part to compare and merge
  const existing = await getPartByIdV2(input.partId, { client, userId })

  // 2. Prepare merged data
  const existingData = toRecord(existing?.data)

  const existingRole =
    typeof existingData.role === 'string' && existingData.role.trim().length > 0
      ? existingData.role
      : null

  const existingEvidence = toStringArray(existingData.recent_evidence)
  const finalEvidence = Array.isArray(input.evidence) && input.evidence.length > 0
    ? input.evidence
    : existingEvidence

  const existingVisualization = toRecord(existingData.visualization)
  const visualization = {
    emoji: input.emoji ?? (typeof existingVisualization.emoji === 'string' ? existingVisualization.emoji : '🧩'),
    color: typeof existingVisualization.color === 'string' ? existingVisualization.color : '#6B7280',
    energyLevel:
      typeof existingVisualization.energyLevel === 'number' ? existingVisualization.energyLevel : 0.5,
  }

  const updatedData: Record<string, unknown> = {
    ...existingData,
    role: input.role ?? existingRole ?? null,
    recent_evidence: finalEvidence,
    visualization,
    markdown_sync: {
      last_synced_at: now,
      source: 'markdown_profile',
    },
  }

  // 3. Detect meaningful changes for optimization logging
  const hasMeaningfulChanges =
    !existing ||
    existing.name !== input.name ||
    existing.status !== input.status ||
    existing.category !== input.category ||
    (input.role !== undefined && (existingRole ?? null) !== (input.role ?? null)) ||
    (input.emoji !== undefined &&
      (typeof existingVisualization.emoji === 'string' ? existingVisualization.emoji : '🧩') !== visualization.emoji) ||
    !arraysEqual(finalEvidence, existingEvidence)

  if (!hasMeaningfulChanges && existing) {
    logger.info({ partId: input.partId }, '[syncPartFromMarkdown] Part unchanged')
  }

  // 4. Upsert
  const payload = {
    id: input.partId,
    name: input.name,
    status: input.status,
    category: input.category,
    charge: existing?.charge ?? 'neutral',
    data: updatedData,
    evidence_count: finalEvidence.length,
    confidence: existing?.confidence ?? 0.5,
    needs_attention: existing?.needs_attention ?? false,
    last_active: now,
    first_noticed: existing?.first_noticed ?? now,
  }

  const result = await upsertPartV2(payload, { client, userId })

  logger.info(
    { partId: input.partId, name: input.name, action: existing ? 'Updated' : 'Created' },
    '[syncPartFromMarkdown] Part synced'
  )

  return result
}
