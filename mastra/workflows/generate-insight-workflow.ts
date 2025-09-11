import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import {
  getRecentSessions,
  getActiveParts,
  getPolarizedRelationships,
  getRecentInsights,
} from '../tools/insight-research-tools';
import { mastra } from '..';
import type {
  SessionRow,
  PartRow,
  PartRelationshipRow,
  InsightRow,
} from '../../lib/types/database';
import { insightSchema, Insight } from '../agents/insight-generator';

const workflowInputSchema = z.object({
  userId: z.string().uuid(),
});

export type GenerateInsightInput = z.infer<typeof workflowInputSchema>;

const sessionRowSchema = z.custom<SessionRow>();
const partRowSchema = z.custom<PartRow>();
const partRelationshipRowSchema = z.custom<PartRelationshipRow>();
const insightRowSchema = z.custom<InsightRow>();

const toolResultSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data: data.optional(),
    error: z.string().optional(),
    confidence: z.number().optional(),
  });

const researchOutputSchema = z.object({
  recentSessions: toolResultSchema(z.array(sessionRowSchema)),
  activeParts: toolResultSchema(z.array(partRowSchema)),
  polarizedRelationships: toolResultSchema(z.array(partRelationshipRowSchema)),
  recentInsights: toolResultSchema(z.array(insightRowSchema)),
});

export type ResearchStepOutput = z.infer<typeof researchOutputSchema>;

interface ExecutionParams<TInput> {
  inputData: TInput;
  [key: string]: unknown;
}

const writingOutputSchema = z.array(insightSchema);
export type WritingStepOutput = Insight[];

export const generateInsightWorkflow = createWorkflow({
  id: 'generate-insight-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: writingOutputSchema,
  steps: [
    {
      id: 'researchStep',
      description: 'Gathers research materials about the user.',
      inputSchema: workflowInputSchema,
      outputSchema: researchOutputSchema,
      async execute({ inputData }: ExecutionParams<GenerateInsightInput>): Promise<ResearchStepOutput> {
        console.log('Workflow: Starting research step for user', inputData.userId);
        const [recentSessions, activeParts, polarizedRelationships, recentInsights] =
          await Promise.all([
            getRecentSessions({ userId: inputData.userId, lookbackDays: 7, limit: 10 }),
            getActiveParts({ userId: inputData.userId, limit: 10 }),
            getPolarizedRelationships({ userId: inputData.userId, limit: 10 }),
            getRecentInsights({ userId: inputData.userId, lookbackDays: 14, limit: 10 }),
          ]);
        return { recentSessions, activeParts, polarizedRelationships, recentInsights };
      },
    },
    {
      id: 'writingStep',
      description: 'Analyzes research and writes insights.',
      inputSchema: workflowInputSchema,
      outputSchema: writingOutputSchema,
      async execute(params: ExecutionParams<GenerateInsightInput>): Promise<WritingStepOutput> {
        const { inputData } = params;
        const { step } = params as unknown as { step: { researchStep: ResearchStepOutput } };
        const researchStepOutput = step.researchStep;
        console.log('Workflow: Starting writing step...');
        const researchSummary = `
          Recent Sessions: ${JSON.stringify(researchStepOutput.recentSessions, null, 2)}
          Active Parts: ${JSON.stringify(researchStepOutput.activeParts, null, 2)}
          Polarized Relationships: ${JSON.stringify(
            researchStepOutput.polarizedRelationships,
            null,
            2
          )}
          Recent Insights: ${JSON.stringify(researchStepOutput.recentInsights, null, 2)}
        `;

        const insightAgent = mastra.getAgent('insightGeneratorAgent');
        const agentRun: { status: string; output?: { insights?: Insight[] } } =
          await insightAgent.run({
            input: researchSummary,
            context: { userId: inputData.userId }, // Pass original userId through
          });

        if (agentRun.status === 'success' && agentRun.output?.insights) {
          return agentRun.output.insights;
        }

        return [];
      },
    },
  ],
});
