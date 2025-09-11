import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { createIfsAgent } from './agents/ifs-agent'
import { insightGeneratorAgent } from './agents/insight-generator'
import { generateInsightWorkflow } from './workflows/generate-insight-workflow'

type Profile = Parameters<typeof createIfsAgent>[0]

let mastraInstance: any = null

export function createMastra(profile: Profile = null) {
  return (new Mastra({
    logger: new PinoLogger({
      name: 'IFS-Therapy-App',
      level: 'info',
    }),
    agents: {
      ifsAgent: createIfsAgent(profile),
      insightGeneratorAgent,
    },
    workflows: {
      generateInsightWorkflow,
    },
  })) as any
}

export function getMastra(profile: Profile = null) {
  if (!mastraInstance) {
    mastraInstance = createMastra(profile)
  }
  return mastraInstance as any
}
