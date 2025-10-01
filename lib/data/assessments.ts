import 'server-only'

import type { PartRow } from '@/lib/types/database'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { recordPartAssessmentSchema, type RecordPartAssessmentInput } from './assessments.schema'
import { createActionLogger } from '@/lib/database/action-logger'

export type RecordPartAssessmentDependencies = {
  client: SupabaseDatabaseClient
  userId: string
}

export async function recordPartAssessment(
  input: RecordPartAssessmentInput,
  deps: RecordPartAssessmentDependencies
): Promise<PartRow> {
  const validated = recordPartAssessmentSchema.parse(input)
  const { client, userId } = deps

  const insertPayload = {
    user_id: userId,
    part_id: validated.partId,
    source: validated.source,
    score: validated.score,
    rationale: validated.rationale,
    evidence_refs: validated.evidenceRefs ?? [],
    model: validated.model,
    idempotency_key: validated.idempotencyKey,
  }

  const { error: assessErr } = await client.from('part_assessments').insert(insertPayload)

  if (assessErr) {
    const message = (assessErr as { message?: string } | null)?.message || ''
    const isIdempotentConflict = message.includes('uq_part_assessments_idem')
    if (!isIdempotentConflict) {
      throw new Error(`Failed to record assessment: ${assessErr.message}`)
    }
  }

  const updates = {
    confidence: validated.score,
    updated_at: new Date().toISOString(),
  }

  const actionLogger = createActionLogger(client)

  const updated = await actionLogger.loggedUpdate<PartRow>(
    'parts',
    validated.partId,
    updates,
    userId,
    'record_part_assessment',
    {
      changeDescription: `Set identification confidence to ${validated.score}`,
      score: validated.score,
      source: validated.source,
      model: validated.model,
    }
  )

  return updated
}
