import { createTool } from '@mastra/core'
import { z } from 'zod'
import { actionLogger } from '../../lib/database/action-logger'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '../../lib/types/database'

// Minimal Supabase client for server-side tool execution
function getEnvVar(keys: string[]): string | undefined {
  const anyProcessEnv = typeof process !== 'undefined' ? (process as any).env : undefined
  if (anyProcessEnv) {
    for (const k of keys) {
      const v = anyProcessEnv[k]
      if (v) return v as string
    }
  }
  return undefined
}

function getSupabaseClient() {
  const url = getEnvVar(['NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'])
  const anonKey = getEnvVar(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'])
  if (!url || !anonKey) {
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n\n" +
      'Missing NEXT_PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.'
    )
  }
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {}
    }
  })
}

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

export async function recordPartAssessment(input: RecordPartAssessmentInput) {
  const supabase = getSupabaseClient()

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
    const updated = await actionLogger.loggedUpdate(
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
    const result = await recordPartAssessment(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  }
})

export const assessmentTools = {
  recordPartAssessment: recordPartAssessmentTool
}

