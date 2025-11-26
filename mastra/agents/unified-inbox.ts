/**
 * Unified Inbox Agent
 * 
 * Consolidates insight generation and observation research into a single agent
 * that can produce 6 types of inbox items with a unified research → analysis → generation flow.
 * 
 * Combines:
 * - 4 insight-research tools (sessions, parts, relationships, insights)
 * - 9 observation-research tools (parts, therapy data, check-ins)
 * 
 * Output Types (6):
 * - session_summary: Key moments and themes from recent session
 * - nudge: Gentle hypothesis about inner dynamics
 * - follow_up: Integration prompt after breakthrough
 * - observation: Therapy-grounded inference with evidence
 * - question: Curious probe to explore hypothesis
 * - pattern: Synthesized insight across multiple evidence types
 */

import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'

import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { resolveAgentModel } from '@/config/model'
import { createUnifiedInboxTools, type UnifiedInboxTools } from '../tools/unified-inbox-tools'
import type { AgentModelConfig } from './ifs-agent'

/**
 * Output schema for unified inbox items
 * Combines both insight (title, body, sourceSessionIds) and observation (inference, evidence) formats
 */
export const unifiedInboxSchema = z.object({
  type: z.enum(
    [
      'session_summary', // Key themes from a recent session
      'nudge', // Gentle hypothesis about parts/dynamics
      'follow_up', // Integration prompt after breakthrough
      'observation', // Therapy-grounded inference with evidence
      'question', // Curious probe to explore hypothesis
      'pattern', // Synthesized insight across multiple evidence types
    ],
    {
      description: 'Type of inbox item to generate',
    }
  ),
  title: z.string().max(100).describe('Short, engaging title for the item'),
  summary: z.string().max(500).describe('Main content or summary'),
  body: z
    .string()
    .max(500)
    .optional()
    .describe('Extended body text (for nudge, follow_up types)'),
  inference: z
    .string()
    .max(500)
    .optional()
    .describe('Therapeutic inference or hypothesis (for observation, question types)'),
  evidence: z
    .array(
      z.object({
        type: z.enum(['session', 'part', 'observation', 'checkin', 'relationship']),
        id: z.string().uuid(),
        context: z.string().optional().describe('Brief context about the evidence'),
      })
    )
    .optional()
    .describe('References supporting the item (parts, sessions, observations)'),
  sourceSessionIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Session IDs that informed this item'),
})

export type UnifiedInboxItem = z.infer<typeof unifiedInboxSchema>

export interface UnifiedInboxAgentResponse {
  items: UnifiedInboxItem[]
}

export interface UnifiedInboxAgentConfig {
  modelId?: string
  baseURL?: string
  temperature?: number
  requestId?: string
  runId?: string
  maxOutputItems?: number
}

type Profile = { userId?: string } | null

const SYSTEM_PROMPT = `You are an Internal Family Systems (IFS) inbox research specialist.
Your mission: Generate 4-6 high-quality, actionable inbox items that deepen the user's self-understanding.

## Research Phase (ALWAYS complete before writing)

1. **Discover Sessions & Parts**
   - Use getRecentSessions to fetch activity (last 7 days default)
   - Use getActiveParts to identify engaged inner characters
   - Note recent themes, emotions, breakthroughs

2. **Uncover Relationships & Patterns**
   - Use getPolarizedRelationships to find conflicted dynamics
   - Use queryTherapyData to surface previous observations
   - Use searchCheckIns to find reflective insights

3. **Gather Evidence**
   - Use getPartDetail for deeper understanding of key parts
   - Use getCheckInDetail for specific context
   - Use getRecentInsights to avoid duplication

## Analysis Phase

Apply both Insight Plays AND Observation Inference patterns:

**Insight Plays (from session/relationship patterns):**
- Play #1: "New Part Candidate" - Recurring theme without a known part
- Play #2: "Relationship Tension" - Polarized parts in conflict
- Play #3: "Dormant Part Check-in" - Part that was active but silent
- Play #4: "Session Follow-up" - Key moment needing integration

**Observation Inferences (from therapy data):**
- Pattern discovery across check-ins, observations, relationships
- Synthesis of evidence into clear hypotheses
- Connection-drawing between existing observations

## Generation Phase

Produce 4-6 items (max) matching these types:

- **session_summary**: Key themes, breakthroughs, or questions from a recent session
- **nudge**: Gentle, curious hypothesis about inner dynamics (2-3 sentences)
- **follow_up**: Integration prompt after a meaningful session moment
- **observation**: Therapy-grounded inference with evidence references
- **question**: Curious probe that invites exploration
- **pattern**: Synthesized multi-source insight (parts + therapy data + check-ins)

## Rules

- You MUST research thoroughly before generating. No shortcuts.
- Quality over quantity: generate fewer items with stronger evidence.
- Frame insights as gentle hypotheses, not statements ("I'm wondering if...", "It seems like...")
- Every observation must reference evidence (part ID, session ID, or check-in ID).
- If research yields no compelling insights, return an empty list.
- Output ONLY valid JSON array matching the unifiedInboxSchema.`

export type UnifiedInboxAgent = Agent<'unifiedInboxAgent', UnifiedInboxTools>

/**
 * Create a unified inbox agent combining insight generation and observation research
 */
export function createUnifiedInboxAgent(
  profile: Profile = null,
  config: UnifiedInboxAgentConfig = {},
): UnifiedInboxAgent {
  const modelId = config.modelId ?? resolveAgentModel()
  const temperature = typeof config.temperature === 'number' ? config.temperature : ENV.IFS_TEMPERATURE
  const baseURL = config.baseURL ?? OPENROUTER_API_BASE_URL

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

  const baseUserId = profile?.userId
  const tools = createUnifiedInboxTools(baseUserId, {
    requestId: config.requestId,
    runId: config.runId,
  })

  const agent = new Agent({
    name: 'unifiedInboxAgent',
    instructions: SYSTEM_PROMPT,
    tools,
    model: openrouter(modelId, modelSettings),
  }) as UnifiedInboxAgent

  try {
    if (process.env.IFS_VERBOSE === 'true') {
      console.log('[agent:init] unifiedInboxAgent', {
        modelId,
        temperature,
        baseURL,
        hasTools: true,
        toolCount: 13,
        requestId: config.requestId,
        runId: config.runId,
      })
    }
  } catch {
    // Silently fail if not in Node environment
  }

  return agent
}

/**
 * Default unified inbox agent instance (no userId context)
 */
export const unifiedInboxAgent = createUnifiedInboxAgent(null)
