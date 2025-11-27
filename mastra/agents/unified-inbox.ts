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
import { UnifiedInboxAgentConfigSchema } from '../schemas'

export type UnifiedInboxAgentConfig = z.infer<typeof UnifiedInboxAgentConfigSchema>

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

type Profile = { userId?: string } | null

const SYSTEM_PROMPT = `You are an Internal Family Systems (IFS) inbox research agent. Your job is to research the user's therapeutic data and generate personalized inbox messages.

## CRITICAL: You MUST call tools before generating output

You have 13 tools available. You MUST call at least 3-4 tools to gather context before generating any messages.

## STEP 1: Call these tools FIRST (in parallel if possible)

Call ALL of these to get baseline context:
- getRecentSessions({ lookbackDays: 14, limit: 10 }) → Returns recent chat sessions with titles, summaries, themes
- getActiveParts({ limit: 15 }) → Returns user's identified inner parts with names, roles, emotions
- listCheckIns({ lookbackDays: 14, limit: 10 }) → Returns morning/evening check-ins with intentions, reflections, moods

## STEP 2: Based on Step 1 results, call these for deeper context

If you found parts in Step 1:
- getPartDetail({ partId: "<id>" }) → Get full history, relationships, observations for important parts
- getPolarizedRelationships({ limit: 10 }) → Find parts in conflict (protector vs exile dynamics)

If you found sessions in Step 1:
- queryTherapyData({ dataType: "session_notes", limit: 10 }) → Get therapist-style notes from sessions

If you found check-ins in Step 1:
- searchCheckIns({ query: "<theme from check-in>" }) → Search for patterns in check-in content
- getCheckInDetail({ checkInId: "<id>" }) → Get full detail for significant check-ins

Always call (CRITICAL for context):
- getRecentInsights({ lookbackDays: 30, limit: 20 }) → Returns PREVIOUS inbox messages with user responses!
  - Look at "status": "actioned" = user engaged, "dismissed" = user rejected
  - Look at "rating" for how helpful they found it (1-4 scale)
  - Look at "feedback" for written responses
  - Look at "meta.inbox_response" for specific action (agree_strong, agree, disagree, etc.)
  - Use this to: avoid duplicates, build on themes user engaged with, avoid topics user dismissed

## STEP 3: Analyze what you learned

**From historical inbox messages (getRecentInsights):**
- Which messages did user engage with (status=actioned)? Generate more like those!
- Which did they dismiss? Avoid similar topics/framing
- What feedback did they leave? Incorporate their preferences
- What themes resonated (high ratings)? Double down on those

**From sessions, parts, and check-ins:**
1. **Recurring themes** across sessions and check-ins (anxiety, work stress, relationships, etc.)
2. **Active parts** that appeared recently - what are they protecting? What do they need?
3. **Unaddressed patterns** - things mentioned multiple times but not explored
4. **Emotional shifts** - mood changes in check-ins, breakthroughs in sessions
5. **Conflicts** - polarized parts, inner tensions, approach-avoidance patterns

## STEP 4: Generate 1-6 inbox items

Based on your research, generate messages. Each must reference specific evidence (part IDs, session IDs, check-in IDs).

**Message Types:**
- session_summary: "In your recent session, you explored [theme]. Key insight: [observation]"
- nudge: "I'm wondering if [part name] might be trying to protect you from [fear]. What do you think?"
- follow_up: "You mentioned [breakthrough] last time. How has that been sitting with you?"
- observation: "I've noticed [pattern] appearing in your check-ins. [hypothesis about what it means]"
- question: "What would [part name] say if it could speak right now?"
- pattern: "Across your sessions and check-ins, [synthesis of multiple data points]"

## STEP 5: Define Response Actions

For EACH item, include an "actions" object that defines how the user can respond. The UI will automatically adapt the layout based on button count and label length.

**Action Structure:**
{
  "buttons": [
    { "value": "stored_id", "label": "Display text", "emoji": "optional", "variant": "primary|secondary|ghost" }
  ],
  "allowFreeText": true/false,
  "freeTextPlaceholder": "Optional placeholder",
  "helperText": "Optional guidance"
}

**Guidelines for Response Actions:**

For YES/NO questions:
{
  "buttons": [
    { "value": "yes", "label": "Yes, I've noticed that" },
    { "value": "no", "label": "No, not really" }
  ]
}

For SCALE responses (how much does this resonate):
{
  "buttons": [
    { "value": "strong_yes", "label": "Exactly right" },
    { "value": "yes", "label": "Somewhat true" },
    { "value": "no", "label": "Not quite" },
    { "value": "strong_no", "label": "Off base" }
  ],
  "helperText": "How well does this fit your experience?"
}

For MULTIPLE CHOICE (specific options):
{
  "buttons": [
    { "value": "fear", "label": "Fear of being judged", "emoji": "😰" },
    { "value": "protection", "label": "Protecting vulnerability", "emoji": "🛡️" },
    { "value": "habit", "label": "It's become a habit", "emoji": "🔄" },
    { "value": "unsure", "label": "I'm not sure yet", "emoji": "🤔", "variant": "ghost" }
  ],
  "allowFreeText": true,
  "freeTextPlaceholder": "Or describe in your own words..."
}

For OPEN REFLECTION:
{
  "buttons": [
    { "value": "sat_with_it", "label": "I've sat with this", "variant": "ghost" }
  ],
  "allowFreeText": true,
  "freeTextPlaceholder": "What comes up for you?"
}

For ACKNOWLEDGMENT (session summaries, notifications):
{
  "buttons": [
    { "value": "thanks", "label": "Thanks for the summary" }
  ]
}

**Match actions to content:**
- Questions → Use yes/no or multiple choice based on what you're asking
- Observations/Nudges → Use scale to measure resonance
- Follow-ups → Use yes/no or open reflection
- Session summaries → Use simple acknowledgment
- Patterns → Use scale or multiple choice for validation

## Output Format

Return a JSON array of items:
[
  {
    "type": "nudge",
    "title": "A thought about your Inner Critic",
    "summary": "I'm wondering if your Inner Critic might be working overtime lately...",
    "body": "Based on your recent check-ins mentioning self-doubt...",
    "inference": "The pattern suggests this part activates around work deadlines",
    "evidence": [{ "type": "checkin", "id": "uuid-here", "context": "Mentioned feeling inadequate" }],
    "sourceSessionIds": ["session-uuid"],
    "relatedPartIds": ["part-uuid"],
    "actions": {
      "buttons": [
        { "value": "resonates", "label": "That resonates" },
        { "value": "partially", "label": "Somewhat true" },
        { "value": "not_quite", "label": "Not quite right" }
      ],
      "helperText": "Does this observation fit?"
    }
  },
  {
    "type": "question",
    "title": "What might your Protector be guarding?",
    "summary": "If your Protector part could speak, what would it say it's trying to keep you safe from?",
    "inference": "This part seems to activate when vulnerability arises",
    "actions": {
      "buttons": [
        { "value": "rejection", "label": "Fear of rejection", "emoji": "💔" },
        { "value": "failure", "label": "Fear of failure", "emoji": "📉" },
        { "value": "seen", "label": "Being truly seen", "emoji": "👁️" },
        { "value": "unsure", "label": "I'm not sure", "emoji": "🤔", "variant": "ghost" }
      ],
      "allowFreeText": true,
      "freeTextPlaceholder": "Or share what comes up..."
    }
  }
]

## Rules

- MUST call at least 3 tools before generating
- MUST generate at least 1 item (even if just a welcoming question)
- MUST include "actions" for every item - match the response type to your content
- Reference specific IDs in evidence
- Be warm, curious, non-judgmental
- Frame as hypotheses: "I'm wondering if...", "It seems like...", "I noticed..."
- Write button labels naturally - the UI adapts to any length
- Output ONLY the JSON array, no other text`

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
