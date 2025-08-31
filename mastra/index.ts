import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { createIfsAgent } from './agents/ifs-agent'
import { insightGeneratorAgent } from './agents/insight-generator'
import { generateInsightWorkflow } from './workflows/generate-insight-workflow'

export const mastra = (new Mastra({
  logger: new PinoLogger({
    name: 'IFS-Therapy-App',
    level: 'info',
  }),
  agents: {
    ifsAgent: createIfsAgent(null),
    insightGeneratorAgent,
  },
  workflows: {
    generateInsightWorkflow,
  },
})) as any
