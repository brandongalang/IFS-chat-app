import { createWorkflow } from '@mastra/core'
import { z } from 'zod'
import {
  createInsightResearchTools,
  getRecentSessions,
  getActiveParts,
  getPolarizedRelationships,
  getRecentInsights,
} from '../tools/insight-research-tools'
import { insightSchema, type InsightGeneratorAgent } from '../agents/insight-generator'
import { SessionSchema, PartSchema, RelationshipSchema, InsightSchema } from '../schemas'

const workflowInputSchema = z.object({
  userId: z.string().uuid(),
})

const researchStepOutputSchema = z.object({
  recentSessions: z.array(SessionSchema),
  activeParts: z.array(PartSchema),
  polarizedRelationships: z.array(RelationshipSchema),
  recentInsights: z.array(InsightSchema),
})

export function createGenerateInsightWorkflow(insightGeneratorAgent: InsightGeneratorAgent) {
  return createWorkflow({
    id: 'generate-insight-workflow',
    inputSchema: workflowInputSchema,
    steps: [
      {
        id: 'researchStep',
        description: 'Gathers research materials about the user.',
        inputSchema: workflowInputSchema,
        outputSchema: researchStepOutputSchema,
        async execute(input: z.infer<typeof workflowInputSchema>) {
          console.log('Workflow: Starting research step for user', input.userId)
          const [recentSessions, activeParts, polarizedRelationships, recentInsights] = await Promise.all([
            getRecentSessions({ userId: input.userId, lookbackDays: 7, limit: 10 }),
            getActiveParts({ userId: input.userId, limit: 10 }),
            getPolarizedRelationships({ userId: input.userId, limit: 10 }),
            getRecentInsights({ userId: input.userId, lookbackDays: 14, limit: 10 }),
          ])
          return { recentSessions, activeParts, polarizedRelationships, recentInsights }
        },
      },
      {
        id: 'writingStep',
        description: 'Analyzes research and writes insights.',
        inputSchema: z.object({
          researchStep: researchStepOutputSchema,
        }),
        outputSchema: z.array(insightSchema),
        async execute(input: any, { step }: any): Promise<any> {
          const researchStepOutput = step.researchStep
          console.log('Workflow: Starting writing step...')
          const researchSummary = `
            Recent Sessions: ${JSON.stringify(researchStepOutput.recentSessions, null, 2)}
            Active Parts: ${JSON.stringify(researchStepOutput.activeParts, null, 2)}
            Polarized Relationships: ${JSON.stringify(researchStepOutput.polarizedRelationships, null, 2)}
            Recent Insights: ${JSON.stringify(researchStepOutput.recentInsights, null, 2)}
          `
          const agentRun = await (insightGeneratorAgent as any).run({
            input: researchSummary,
            context: { userId: input.userId },
          })

          if (agentRun.status === 'success' && agentRun.output) {
            return agentRun.output.insights || []
          }

          return []
        },
      },
    ],
  })
}
