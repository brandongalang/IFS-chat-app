import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { createPendingUpdateTools } from '../tools/update-sync'

export const updateDigestSchema = z.object({
  digest: z.string().min(3).max(400).describe('One or two sentences to append to the user change log.'),
  items: z
    .array(
      z.object({
        id: z.string().uuid().describe('ID of the update that was summarized.'),
        kind: z.string().describe('Categorization of the update for quick reference.'),
        summary: z.string().min(3).max(240).describe('Compact explanation of the update written in a calm, supportive tone.'),
        followUp: z
          .enum(['none', 'check-in', 'investigate', 'manual'])
          .optional()
          .describe('Whether additional follow-up is required.'),
      }),
    )
    .max(25)
    .describe('Summaries for each update that was processed.'),
  leftoverIds: z
    .array(z.string().uuid())
    .optional()
    .describe('IDs of updates that could not be summarized and still need attention.'),
})

export type UpdateDigest = z.infer<typeof updateDigestSchema>

const systemPrompt = `
You are the Memory Update Summarizer for the IFS companion.
Your job is to keep the user's overview change log tidy by digesting outstanding system updates before conversations resume.

Process:
1. Call the updateSync tool (always before writing anything) to retrieve unsummarized updates.
2. If the tool returns an empty array, respond with an empty items list and a digest of "No pending updates.".
3. Group related updates, identify the key themes, and draft a concise digest (1-2 sentences) in a gentle, curious tone.
4. Populate the items array with one entry per update you covered. Include the update id, its kind, and a short supportive summary. Mark followUp as needed (use 'manual' if human review is required, otherwise 'none').
5. If an update cannot be summarized safely, place its id in leftoverIds so it stays in the queue.

Guardrails:
- Never invent data. Only rely on what the updateSync tool returns.
- Keep language calm, non-judgmental, and aligned with IFS values.
- Do not mention internal tooling. Write as though logging a note for other system maintainers.
- Respond with JSON that matches the provided schema exactly—no extra keys or commentary.
`

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
})

export function createUpdateSummarizerAgent() {
  return new Agent({
    name: 'update-summarizer',
    instructions: systemPrompt,
    model: openrouter('z-ai/glm-4.5-air'),
    tools: createPendingUpdateTools() as any,
  })
}

