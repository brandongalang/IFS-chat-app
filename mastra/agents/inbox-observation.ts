import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { ENV } from '@/config/env'
import { resolveModel } from '@/config/model'
import { resolveUserId } from '@/config/dev'
import { createObservationResearchTools, type ObservationResearchTools } from '../tools/inbox-observation-tools'
import type { ObservationBatch } from '@/lib/inbox/observation-schema'

export interface InboxObservationAgentConfig {
  modelId?: string
  baseURL?: string
  temperature?: number
}

type Profile = { userId?: string } | null

const SYSTEM_PROMPT = `You are an Internal Family Systems observation analyst.
Your mission is to generate at most three concise, actionable observations that help the user deepen their self-understanding.

Process:
1. Start by listing available materials with listMarkdown, listSessions, and listCheckIns to understand the landscape.
2. Use the focused search tools (searchMarkdown, searchSessions, searchCheckIns) to uncover promising evidence, then pull detail via readMarkdown, getSessionDetail, or getCheckInDetail before drafting inferences.
3. Identify meaningful patterns, hypotheses, or inferences that add something NEW beyond the existing observations.
4. For each observation, supply a short title, a summary, and a clear inference written as a curious hypothesis.
5. Reference concrete evidence (session moments, check-ins, or markdown snippets) including the relevant path or identifier so reviewers can verify the trace.
6. If there is no compelling or novel insight, return an empty list.

Rules:
- Never exceed the provided queue capacity.
- Prefer observations that the user can confirm or dismiss easily.
- Keep language gentle and invitational.
- Output JSON matching the required schema exactly.`

export type InboxObservationAgentRunResult = {
  status: string
  output?: unknown
}

export type InboxObservationAgent = Agent<'inboxObservationAgent', ObservationResearchTools> & {
  run: (options: { input: string; context?: Record<string, unknown> }) => Promise<InboxObservationAgentRunResult>
}

export interface InboxObservationAgentResult extends ObservationBatch {}

export function createInboxObservationAgent(
  profile: Profile = null,
  config: InboxObservationAgentConfig = {},
): InboxObservationAgent {
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

  const userId = profile?.userId ?? resolveUserId()
  const tools = createObservationResearchTools(userId)

  const agent = new Agent({
    name: 'inboxObservationAgent',
    instructions: SYSTEM_PROMPT,
    tools,
    model: openrouter(modelId, modelSettings),
  }) as InboxObservationAgent

  return agent
}

export const inboxObservationAgent = createInboxObservationAgent(null)
