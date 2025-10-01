import { createTool } from '@mastra/core'
import { getServerSupabaseClient } from '@/lib/supabase/clients'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { recordPartAssessment as recordPartAssessmentData } from '@/lib/data/assessments'
import { recordPartAssessmentSchema, type RecordPartAssessmentInput } from '@/lib/data/assessments.schema'

async function resolveDependencies(
  baseUserId: string | undefined,
  runtime?: { userId?: string }
): Promise<{ client: SupabaseDatabaseClient; userId: string }> {
  const supabase = await getServerSupabaseClient()
  const userId = baseUserId ?? runtime?.userId
  if (!userId) {
    throw new Error('userId is required to record part assessments')
  }
  return { client: supabase, userId }
}

export function createAssessmentTools(userId?: string) {
  const recordPartAssessmentTool = createTool({
    id: 'recordPartAssessment',
    description:
      "Record an identification assessment for a part (LLM-as-judge or human) and set the part's confidence explicitly. Provide idempotencyKey to avoid duplicate application on retries.",
    inputSchema: recordPartAssessmentSchema,
    execute: async ({ context, runtime }: { context: RecordPartAssessmentInput; runtime?: { userId?: string } }) => {
      const input = recordPartAssessmentSchema.parse(context)
      const deps = await resolveDependencies(userId, runtime)
      const updated = await recordPartAssessmentData(input, deps)
      return updated
    },
  })

  return {
    recordPartAssessment: recordPartAssessmentTool,
  }
}

export type AssessmentTools = ReturnType<typeof createAssessmentTools>
