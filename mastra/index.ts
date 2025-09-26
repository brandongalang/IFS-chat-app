import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createIfsAgent } from './agents/ifs-agent'
import { createInsightGeneratorAgent } from './agents/insight-generator'
import { createGenerateInsightWorkflow } from './workflows/generate-insight-workflow'
import { createUpdateSummarizerAgent } from './agents/update-summarizer'

type Profile = Parameters<typeof createIfsAgent>[0]

let mastraInstance: InstanceType<typeof Mastra> | null = null

export function createMastra(profile: Profile = null) {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  })

  const ifsAgent = createIfsAgent(profile, openrouter)
  const insightGeneratorAgent = createInsightGeneratorAgent(openrouter)
  const updateSummarizerAgent = createUpdateSummarizerAgent(openrouter)
  const insightWorkflow = createGenerateInsightWorkflow(insightGeneratorAgent)

  return new Mastra({
    logger: new PinoLogger({
      name: 'IFS-Therapy-App',
      level: 'info',
    }),
    // Expose agents and workflows to the Mastra runtime
    agents: {
      ifsAgent,
      insightGeneratorAgent,
      updateSummarizerAgent,
    },
    workflows: {
      generateInsightWorkflow: insightWorkflow,
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
