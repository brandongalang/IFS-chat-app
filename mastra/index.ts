import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { createIfsAgent } from './agents/ifs-agent'
import { insightGeneratorAgent } from './agents/insight-generator'
import { generateInsightWorkflow } from './workflows/generate-insight-workflow'
import { createUpdateSummarizerAgent } from './agents/update-summarizer'

type Profile = Parameters<typeof createIfsAgent>[0]

let mastraInstance: any = null

export function createMastra(profile: Profile = null) {
  return new Mastra({
    logger: new PinoLogger({
      name: 'IFS-Therapy-App',
      level: 'info',
    }),
    // Expose agents and workflows to the Mastra runtime
    agents: {
      ifsAgent: createIfsAgent(profile),
      insightGeneratorAgent,
      updateSummarizerAgent: createUpdateSummarizerAgent(),
    },
    workflows: {
      generateInsightWorkflow,
    },
    // Optional telemetry config can be added here when needed
    // telemetry: { /* configure telemetry here if desired */ },
  }) as any
}

export function getMastra(profile: Profile = null) {
  if (!mastraInstance) {
    mastraInstance = createMastra(profile)
  }
  return mastraInstance as any
}

// Export a default Mastra instance for the Mastra CLI dev entry
// The CLI expects: export const mastra = new Mastra({ ... })
export const mastra = getMastra()
