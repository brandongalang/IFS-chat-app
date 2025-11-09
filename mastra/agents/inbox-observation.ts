/**
 * @deprecated Use `createUnifiedInboxAgent` from `./unified-inbox` instead.
 * This agent is kept for backward compatibility but all new work should use the unified agent.
 * 
 * Migration: Replace `createInboxObservationAgent()` with `createUnifiedInboxAgent()`
 * The unified agent combines observation research with insight generation into a single
 * research → analysis → generation flow supporting 6 output types.
 */

import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { resolveAgentModel } from '@/config/model'
import { createObservationResearchTools, type ObservationResearchTools } from '../tools/inbox-observation-tools'
import type { ObservationBatch } from '@/lib/inbox/observation-schema'

export interface InboxObservationAgentConfig {
  modelId?: string
  baseURL?: string
  temperature?: number
  requestId?: string
  runId?: string
}

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
  const modelId = config.modelId ?? resolveAgentModel()
  const temperature = typeof config.temperature === 'number' ? config.temperature : ENV.IFS_TEMPERATURE
  const baseURL = config.baseURL ?? OPENROUTER_API_BASE_URL

  const openrouter = createOpenRouter({
    apiKey: ENV.OPENROUTER_API_KEY,
    baseURL,
  })

  const modelSettings = typeof temperature === 'number'
    ? ({ extraBody: { temperature } } as const)
    : undefined

  const baseUserId = profile?.userId
  const tools = createObservationResearchTools(baseUserId, {
    requestId: config.requestId,
    runId: config.runId,
  })

  const agent = new Agent({
    name: 'inboxObservationAgent',
    instructions: SYSTEM_PROMPT,
    tools,
    model: openrouter(modelId, modelSettings),
  }) as InboxObservationAgent

  try {
    if (process.env.IFS_VERBOSE === 'true') {
      console.log('[agent:init] inboxObservationAgent', {
        modelId,
        temperature,
        baseURL,
        hasTools: true,
        requestId: config.requestId,
        runId: config.runId,
      })
    }
  } catch {}

  return agent
}

export const inboxObservationAgent = createInboxObservationAgent(null)
