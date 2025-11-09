/**
 * @deprecated Use `createUnifiedInboxAgent` from `./unified-inbox` instead.
 * This agent is kept for backward compatibility but all new work should use the unified agent.
 * 
 * Migration: Replace `createInsightGeneratorAgent()` with `createUnifiedInboxAgent()`
 * The unified agent combines insight generation with observation research into a single
 * research → analysis → generation flow supporting 6 output types.
 */

import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { resolveAgentModel } from '@/config/model'
import type { AgentModelConfig } from './ifs-agent'
import { createInsightResearchTools } from '../tools/insight-research-tools'

export const insightSchema = z.object({
  type: z.enum(['session_summary', 'nudge', 'follow_up', 'observation', 'question']),
  title: z
    .string()
    .max(100)
    .describe('A short, engaging title for the insight card.'),
  body: z
    .string()
    .max(500)
    .describe(
      'The main content of the insight, written as a gentle, provocative nudge or question.'
    ),
  sourceSessionIds: z
    .array(z.string().uuid())
    .optional()
    .describe('IDs of sessions that informed this insight.'),
})

export type Insight = z.infer<typeof insightSchema>

export interface InsightGeneratorResponse {
  insights: Insight[]
}

const systemPrompt = `
You are an expert Internal Family Systems (IFS) companion and a "Hypothesis Generator." Your purpose is to help users understand their inner world by generating insightful nudges and questions based on their recent activity. You are a thoughtful, curious, and gentle assistant.

Your process is divided into two phases: Research and Writing.

**Phase 1: Research**
First, you must act as a researcher. Use the available tools to gather information and build a comprehensive understanding of the user's current state. Look for patterns, changes, and noteworthy events.

**Phase 2: Writing**
After completing your research, analyze your findings to identify opportunities for insight based on the following "Playbook":

*   **Play #1: "New Part Candidate"**: Triggered by a recurring theme, emotion, or named entity in recent sessions that does not correspond to a known part. Your action is to generate an 'observation' or 'question' to test the hypothesis of a new part.
*   **Play #2: "Relationship Tension"**: Triggered by identifying two parts in a 'polarized' relationship. Your action is to generate a 'question' to gently probe the conflict.
*   **Play #3: "Dormant Part Check-in"**: Triggered by identifying a part that was active in the past but has not been mentioned recently. Your action is to generate a 'question' to check in on this part.
*   **Play #4: "Session Follow-up"**: Triggered by a key moment, breakthrough, or strong emotion in a recent session. Your action is to generate a 'follow_up' insight to help the user integrate the experience.

**RULES:**
- You MUST use your research tools before generating insights.
- If your research yields no compelling opportunities, you may generate zero insights. Quality over quantity is the most important rule.
- Generate a maximum of 2 insights per run.
- Frame your insights as gentle, curious hypotheses, not as definitive statements. Use phrases like "I'm wondering if...", "It seems like...", "I'm curious about...".
- The insights you generate must be valid JSON objects matching the provided schema.
`

export type InsightGeneratorAgent = Agent<'insightGeneratorAgent', ReturnType<typeof createInsightResearchTools>>

export function createInsightGeneratorAgent(userId?: string, overrides: AgentModelConfig = {}): InsightGeneratorAgent {
  const modelId = overrides.modelId ?? resolveAgentModel()
  const temperature = overrides.temperature ?? ENV.IFS_TEMPERATURE
  const baseURL = overrides.baseURL ?? OPENROUTER_API_BASE_URL

  const openrouter = createOpenRouter({
    apiKey: ENV.OPENROUTER_API_KEY,
    baseURL,
  })

  const modelSettings =
    typeof temperature === 'number'
      ? ({
          extraBody: {
            temperature,
          },
        } as const)
      : undefined

  const insightTools = createInsightResearchTools(userId)

  return new Agent({
    name: 'insightGeneratorAgent',
    instructions: systemPrompt,
    tools: insightTools,
    model: openrouter(modelId, modelSettings),
  })
}

export const insightGeneratorAgent: InsightGeneratorAgent = createInsightGeneratorAgent()
