/**
 * @deprecated Use `createUnifiedInboxAgent` from `./unified-inbox` instead.
 * This agent is kept for backward compatibility but all new work should use the unified agent.
 * 
 * Migration: Replace `createInboxObservationAgent()` with `createUnifiedInboxAgent()`
 * The unified agent combines observation research with insight generation into a single
 * research → analysis → generation flow supporting 6 output types.
 */

import { z } from 'zod'
import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { resolveAgentModel } from '@/config/model'
import { createObservationResearchTools, type ObservationResearchTools } from '../tools/inbox-observation-tools'
import type { ObservationBatch } from '@/lib/inbox/observation-schema'
import { AgentModelConfigSchema, AgentRunOptionsSchema } from '../schemas'

export type InboxObservationAgentConfig = z.infer<typeof AgentModelConfigSchema>

type Profile = { userId?: string } | null

const SYSTEM_PROMPT = `You are an Internal Family Systems observation analyst.
Your mission is to generate at most three concise, actionable observations that help the user deepen their self-understanding.

Process:
1. Start by searching for relevant data with searchParts to find parts the user has worked with, then queryTherapyData to uncover existing observations and relationships. Use listCheckIns to understand recent check-in activity.
2. Use the focused search tools (searchCheckIns, queryTherapyData) to uncover promising evidence, then pull detail via getPartDetail or getCheckInDetail before drafting inferences.
3. Identify meaningful patterns, hypotheses, or inferences that add something NEW beyond the existing observations.
4. For each observation, supply a short title, a summary, and a clear inference written as a curious hypothesis.
5. Reference concrete evidence (parts involved, check-in reflections, or therapy notes) including the relevant part ID or check-in ID so reviewers can verify the trace.
6. If there is no compelling or novel insight, return an empty list.

Rules:
- Never exceed the provided queue capacity.
- Prefer observations that the user can confirm or dismiss easily.
- Keep language gentle and invitational.
- Output ONLY valid JSON array matching the schema: [{ title: string, summary: string, inference: string, evidence: [...] }]
- Ensure every observation has title, summary, inference, and evidence array.
- If no insights found, output: []`

export const InboxObservationAgentRunResultSchema = z.object({
  status: z.string(),
  output: z.unknown().optional(),
})

export type InboxObservationAgentRunResult = z.infer<typeof InboxObservationAgentRunResultSchema>

export type InboxObservationAgent = Agent<'inboxObservationAgent', ObservationResearchTools> & {
  run: (options: z.infer<typeof AgentRunOptionsSchema>) => Promise<InboxObservationAgentRunResult>
}

export interface InboxObservationAgentResult extends ObservationBatch {}

export function createInboxObservationAgent(
  profile: Profile = null,
  config: InboxObservationAgentConfig = {},
): InboxObservationAgent {
  const agentConfig = AgentModelConfigSchema.parse(config)
  const modelId = agentConfig.modelId ?? resolveAgentModel()
  const temperature = typeof agentConfig.temperature === 'number' ? agentConfig.temperature : ENV.IFS_TEMPERATURE
  const baseURL = agentConfig.baseURL ?? OPENROUTER_API_BASE_URL

  const openrouter = createOpenRouter({
    apiKey: ENV.OPENROUTER_API_KEY,
    baseURL,
  })

  const modelSettings = typeof temperature === 'number'
    ? ({ extraBody: { temperature } } as const)
    : undefined

  const baseUserId = profile?.userId
  const tools = createObservationResearchTools(baseUserId)

  const baseAgent = new Agent({
    name: 'inboxObservationAgent',
    instructions: SYSTEM_PROMPT,
    tools,
    model: openrouter(modelId, modelSettings),
  })

  const agent = Object.assign(baseAgent, {
    run: async (options: z.infer<typeof AgentRunOptionsSchema>): Promise<InboxObservationAgentRunResult> => {
      try {
        const response = await (baseAgent as any).generateVNext(options.input)
        let output: unknown = null
        const text = response?.text ?? response?.output?.text ?? ''
        if (text) {
          try {
            output = JSON.parse(text)
          } catch {
            output = { observations: [] }
          }
        }
        return {
          status: 'success',
          output: typeof output === 'object' && output !== null && 'observations' in output
            ? output
            : { observations: Array.isArray(output) ? output : [] },
        }
      } catch (error) {
        console.error('[inbox-observation-agent] generate failed:', error)
        return {
          status: 'error',
          output: null,
        }
      }
    },
  }) as InboxObservationAgent

  return agent
}

export const inboxObservationAgent = createInboxObservationAgent(null)
