import { z } from 'zod'

export const recordPartAssessmentSchema = z
  .object({
    partId: z.string().uuid().describe('The UUID of the part to assess'),
    score: z
      .number()
      .min(0)
      .max(1)
      .describe('Identification confidence score (0..1) from LLM-as-judge or human'),
    rationale: z
      .string()
      .min(1)
      .max(2000)
      .describe('Why this score was chosen'),
    evidenceRefs: z
      .array(z.string())
      .optional()
      .default([])
      .describe('Optional evidence IDs/notes'),
    source: z
      .enum(['agent_llm', 'human'])
      .default('agent_llm'),
    model: z.string().optional().describe('Model identifier if source is agent_llm'),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .optional()
      .describe('Prevents duplicate application on retries'),
  })
  .strict()

export type RecordPartAssessmentInput = z.infer<typeof recordPartAssessmentSchema>
