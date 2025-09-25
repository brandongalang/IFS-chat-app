import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import type {
  InsightRow,
  PartRelationshipRow,
  PartRow,
  SessionRow,
  ToolResult,
} from '@/lib/types/database'
import {
  getActiveParts,
  getPolarizedRelationships,
  getRecentInsights,
  getRecentSessions,
} from '../tools/insight-research-tools'
import { insightGeneratorAgent, insightSchema, type Insight } from '../agents/insight-generator'

const DEFAULT_SESSION_LOOKBACK_DAYS = 7
const DEFAULT_SESSION_LIMIT = 10
const DEFAULT_PART_LIMIT = 10
const DEFAULT_RELATIONSHIP_LIMIT = 10
const DEFAULT_INSIGHT_LOOKBACK_DAYS = 14
const DEFAULT_INSIGHT_LIMIT = 10

const workflowInputSchema = z.object({
  userId: z.string().uuid(),
  sessionLookbackDays: z.number().int().min(1).max(30).optional(),
  sessionLimit: z.number().int().min(1).max(50).optional(),
  partLimit: z.number().int().min(1).max(50).optional(),
  relationshipLimit: z.number().int().min(1).max(50).optional(),
  insightLookbackDays: z.number().int().min(1).max(90).optional(),
  insightLimit: z.number().int().min(1).max(50).optional(),
})

type WorkflowInput = z.infer<typeof workflowInputSchema>

type ResearchSnapshot = {
  recentSessions: ToolResult<SessionRow[]>
  activeParts: ToolResult<PartRow[]>
  polarizedRelationships: ToolResult<PartRelationshipRow[]>
  recentInsights: ToolResult<InsightRow[]>
}

const isToolResult = (value: unknown): value is ToolResult<unknown> =>
  typeof value === 'object' && value !== null && 'success' in (value as Record<string, unknown>)

const toolResultSchema = <T>() =>
  z.custom<ToolResult<T>>(isToolResult, {
    message: 'Invalid tool result received from research step',
  })

const researchStepOutputSchema = z.object({
  recentSessions: toolResultSchema<SessionRow[]>(),
  activeParts: toolResultSchema<PartRow[]>(),
  polarizedRelationships: toolResultSchema<PartRelationshipRow[]>(),
  recentInsights: toolResultSchema<InsightRow[]>(),
}) satisfies z.ZodType<ResearchSnapshot>

const workflowOutputSchema = z.array(insightSchema)

const getEffectiveInput = (input: WorkflowInput) => {
  const {
    userId,
    sessionLookbackDays = DEFAULT_SESSION_LOOKBACK_DAYS,
    sessionLimit = DEFAULT_SESSION_LIMIT,
    partLimit = DEFAULT_PART_LIMIT,
    relationshipLimit = DEFAULT_RELATIONSHIP_LIMIT,
    insightLookbackDays = DEFAULT_INSIGHT_LOOKBACK_DAYS,
    insightLimit = DEFAULT_INSIGHT_LIMIT,
  } = input

  return {
    userId,
    sessionLookbackDays,
    sessionLimit,
    partLimit,
    relationshipLimit,
    insightLookbackDays,
    insightLimit,
  }
}

const researchStep = createStep({
  id: 'researchStep',
  description: 'Collects recent sessions, parts, relationships, and insights for the user.',
  inputSchema: workflowInputSchema,
  outputSchema: researchStepOutputSchema,
  async execute({ inputData }) {
    const effectiveInput = getEffectiveInput(workflowInputSchema.parse(inputData))

    const [recentSessions, activeParts, polarizedRelationships, recentInsights] = await Promise.all([
      getRecentSessions({
        userId: effectiveInput.userId,
        lookbackDays: effectiveInput.sessionLookbackDays,
        limit: effectiveInput.sessionLimit,
      }),
      getActiveParts({
        userId: effectiveInput.userId,
        limit: effectiveInput.partLimit,
      }),
      getPolarizedRelationships({
        userId: effectiveInput.userId,
        limit: effectiveInput.relationshipLimit,
      }),
      getRecentInsights({
        userId: effectiveInput.userId,
        lookbackDays: effectiveInput.insightLookbackDays,
        limit: effectiveInput.insightLimit,
      }),
    ])

    return {
      recentSessions,
      activeParts,
      polarizedRelationships,
      recentInsights,
    }
  },
})

const writingStep = createStep({
  id: 'writingStep',
  description: 'Synthesizes the research snapshot into up to two actionable insights.',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  async execute({ inputData, getStepResult }) {
    const effectiveInput = getEffectiveInput(workflowInputSchema.parse(inputData))
    const researchData = getStepResult(researchStep)

    const safeData = <T>(result: ToolResult<T>): T | [] => {
      if (!result.success) {
        return []
      }
      return result.data ?? []
    }

    const researchPayload = {
      parameters: {
        sessionLookbackDays: effectiveInput.sessionLookbackDays,
        sessionLimit: effectiveInput.sessionLimit,
        partLimit: effectiveInput.partLimit,
        relationshipLimit: effectiveInput.relationshipLimit,
        insightLookbackDays: effectiveInput.insightLookbackDays,
        insightLimit: effectiveInput.insightLimit,
      },
      datasets: {
        recentSessions: safeData(researchData.recentSessions),
        activeParts: safeData(researchData.activeParts),
        polarizedRelationships: safeData(researchData.polarizedRelationships),
        recentInsights: safeData(researchData.recentInsights),
      },
      toolStatuses: {
        recentSessions: researchData.recentSessions.success,
        activeParts: researchData.activeParts.success,
        polarizedRelationships: researchData.polarizedRelationships.success,
        recentInsights: researchData.recentInsights.success,
      },
    }

    const structuredOutputSchema = z.object({
      insights: z.array(insightSchema).max(2).default([]),
    })

    try {
      const generation = await insightGeneratorAgent.generate(
        [
          {
            role: 'system',
            content:
              'You are provided with pre-aggregated research data. Use it to craft up to two high-quality insights. Do not hallucinate missing context.',
          },
          {
            role: 'user',
            content: `User ID: ${effectiveInput.userId}\nResearch Summary:\n${JSON.stringify(researchPayload, null, 2)}`,
          },
        ],
        {
          output: structuredOutputSchema,
          runId: `generate-insight-${effectiveInput.userId}`,
        }
      )

      const insights = generation.object?.insights ?? []
      return insights.slice(0, 2)
    } catch (error) {
      console.error('writingStep failed to generate insights', error)
      return []
    }
  },
})

export const generateInsightWorkflow = createWorkflow({
  id: 'generate-insight-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  steps: [researchStep, writingStep],
})
