import { createTool } from '@mastra/core'
import { z } from 'zod'
import { DatabaseActionLogger } from '../../lib/database/action-logger'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/types/database'

const recordPartAssessmentSchema = z.object({
  userId: z.string().uuid().describe('User ID who owns the part'),
  partId: z.string().uuid().describe('The UUID of the part to assess'),
  score: z.number().min(0).max(1).describe('Identification confidence score (0..1) from LLM-as-judge or human'),
  rationale: z.string().min(1).max(2000).describe('Why this score was chosen'),
  evidenceRefs: z.array(z.string()).optional().default([]).describe('Optional evidence IDs/notes'),
  source: z.enum(['agent_llm','human']).default('agent_llm'),
  model: z.string().optional().describe('Model identifier if source is agent_llm'),
  idempotencyKey: z.string().min(8).max(128).optional().describe('Prevents duplicate application on retries')
})

export type RecordPartAssessmentInput = z.infer<typeof recordPartAssessmentSchema>

export async function recordPartAssessment(
  supabase: SupabaseClient<Database>,
  input: RecordPartAssessmentInput,
) {

  // Insert assessment row with idempotency
  const { error: assessErr } = await supabase
    .from('part_assessments')
    .insert({
      user_id: input.userId,
      part_id: input.partId,
      source: input.source,
      score: input.score,
      rationale: input.rationale,
      evidence_refs: input.evidenceRefs || [],
      model: input.model,
      idempotency_key: input.idempotencyKey
    })

  if (assessErr) {
    // If unique violation (idempotency), treat as success and continue to set confidence
    const msg = (assessErr as any).message || ''
    const isIdem = msg.includes('uq_part_assessments_idem')
    if (!isIdem) {
      return { success: false, error: `Failed to record assessment: ${assessErr.message}` }
    }
  }

  // Update the part confidence explicitly via action logger (ensures audit trail)
  const updates = { confidence: input.score, updated_at: new Date().toISOString() }

  try {
    const logger = new DatabaseActionLogger(supabase)
    const updated = await logger.loggedUpdate(
      'parts',
      input.partId,
      updates,
      input.userId,
      'record_part_assessment',
      {
        partName: undefined,
        changeDescription: `Set identification confidence to ${input.score}`,
        score: input.score,
        source: input.source,
        model: input.model
      }
    )

    return { success: true, data: updated, confidence: input.score }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unknown error while updating part confidence' }
  }
}

export const recordPartAssessmentTool = createTool({
  id: 'recordPartAssessment',
  description: 'Record an identification assessment for a part (LLM-as-judge or human) and set the part\'s confidence explicitly. Provide idempotencyKey to avoid duplicate application on retries.',
  inputSchema: recordPartAssessmentSchema,
  execute: async ({ context }) => {
    const { supabase, ...input } = context as RecordPartAssessmentInput & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to assessment tool context')
    }

    const result = await recordPartAssessment(supabase, input)
    if (!result.success) throw new Error(result.error)
    return result.data
  }
})

export const assessmentTools = {
  recordPartAssessment: recordPartAssessmentTool
}
