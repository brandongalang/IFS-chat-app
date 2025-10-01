import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { ENV } from '@/config/env'
import { resolveModel } from '@/config/model'
import { observationResearchTools } from '../tools/inbox-observation-tools'
import type { ObservationBatch } from '@/lib/inbox/observation-schema'

export interface InboxObservationAgentConfig {
  modelId?: string
  baseURL?: string
  temperature?: number
}

const SYSTEM_PROMPT = `You are an Internal Family Systems observation analyst.
Your mission is to generate at most three concise, actionable observations that help the user deepen their self-understanding.

Process:
1. Use the available search tools (searchMarkdown, searchSessions, searchCheckIns) to gather relevant context.
2. Identify meaningful patterns, hypotheses, or inferences that add something NEW beyond the existing observations.
3. For each observation, supply a short title, a summary, and a clear inference written as a curious hypothesis.
4. Reference concrete evidence (session moments, check-ins, or markdown snippets) when possible.
5. If there is no compelling or novel insight, return an empty list.

Rules:
- Never exceed the provided queue capacity.
- Prefer observations that the user can confirm or dismiss easily.
- Keep language gentle and invitational.
- Output JSON matching the required schema exactly.`

export type InboxObservationAgent = Agent<'inboxObservationAgent', typeof observationResearchTools>

export interface InboxObservationAgentResult extends ObservationBatch {}

export function createInboxObservationAgent(config: InboxObservationAgentConfig = {}): InboxObservationAgent {
  const modelId = config.modelId ?? resolveModel(ENV.IFS_MODEL)
  const temperature = typeof config.temperature === 'number' ? config.temperature : ENV.IFS_TEMPERATURE
  const baseURL = config.baseURL ?? ENV.IFS_PROVIDER_BASE_URL ?? ENV.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'

  const openrouter = createOpenRouter({
    apiKey: ENV.OPENROUTER_API_KEY,
    baseURL,
  })

  const modelSettings = typeof temperature === 'number'
    ? ({ extraBody: { temperature } } as const)
    : undefined

  const agent = new Agent({
    name: 'inboxObservationAgent',
    instructions: SYSTEM_PROMPT,
    tools: observationResearchTools,
    model: openrouter(modelId, modelSettings),
  }) as InboxObservationAgent

  return agent
}

export const inboxObservationAgent = createInboxObservationAgent()
