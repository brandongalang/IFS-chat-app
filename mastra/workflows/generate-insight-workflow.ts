import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { insightResearchTools } from '../tools/insight-research-tools';
import { mastra } from '..';

const workflowInputSchema = z.object({
  userId: z.string().uuid(),
});

export const generateInsightWorkflow = createWorkflow({
  id: 'generate-insight-workflow',
  inputSchema: workflowInputSchema,
  steps: [
    {
      id: 'researchStep',
      description: 'Gathers research materials about the user.',
      async resolve(input) {
        console.log('Workflow: Starting research step for user', input.userId);
        const [recentSessions, activeParts, polarizedRelationships, recentInsights] = await Promise.all([
          insightResearchTools.getRecentSessions.execute({ context: { userId: input.userId } }),
          insightResearchTools.getActiveParts.execute({ context: { userId: input.userId } }),
          insightResearchTools.getPolarizedRelationships.execute({ context: { userId: input.userId } }),
          insightResearchTools.getRecentInsights.execute({ context: { userId: input.userId } }),
        ]);
        return { recentSessions, activeParts, polarizedRelationships, recentInsights };
      },
    },
    {
      id: 'writingStep',
      description: 'Analyzes research and writes insights.',
      async resolve(input, { step }) {
        const researchStepOutput = step.researchStep;
        console.log('Workflow: Starting writing step...');
        const researchSummary = `
          Recent Sessions: ${JSON.stringify(researchStepOutput.recentSessions, null, 2)}
          Active Parts: ${JSON.stringify(researchStepOutput.activeParts, null, 2)}
          Polarized Relationships: ${JSON.stringify(researchStepOutput.polarizedRelationships, null, 2)}
          Recent Insights: ${JSON.stringify(researchStepOutput.recentInsights, null, 2)}
        `;

        const insightAgent = mastra.getAgent('insightGeneratorAgent');
        const agentRun = await insightAgent.run({
          input: researchSummary,
          context: { userId: input.userId }, // Pass original userId through
        });

        if (agentRun.status === 'success' && agentRun.output) {
          return agentRun.output.insights || [];
        }

        return [];
      },
    },
  ],
});
