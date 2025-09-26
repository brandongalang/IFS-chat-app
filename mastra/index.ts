import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ENV } from '@/config/env'
import { resolveModel } from '@/config/model'
import { createIfsAgent, type AgentModelConfig } from './agents/ifs-agent'
import { createInsightGeneratorAgent } from './agents/insight-generator'
import { createGenerateInsightWorkflow } from './workflows/generate-insight-workflow'
import { createUpdateSummarizerAgent } from './agents/update-summarizer'

type Profile = Parameters<typeof createIfsAgent>[0]

let mastraInstance: InstanceType<typeof Mastra> | null = null

const defaultModelId = resolveModel(ENV.IFS_MODEL)
const agentConfig: AgentModelConfig = {
  modelId: defaultModelId,
  temperature: ENV.IFS_TEMPERATURE,
}

if (process.env.NODE_ENV !== 'test') {
  console.info('[Mastra] Agent configuration', {
    modelId: agentConfig.modelId,
    temperature: agentConfig.temperature,
    baseURL: ENV.IFS_PROVIDER_BASE_URL ?? ENV.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  })
}

export function createMastra(profile: Profile = null) {
  const openrouter = createOpenRouter({
    apiKey: ENV.OPENROUTER_API_KEY,
    baseURL: ENV.IFS_PROVIDER_BASE_URL ?? ENV.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  })

  const ifsAgent = createIfsAgent(profile, openrouter, agentConfig)
  const insightGeneratorAgent = createInsightGeneratorAgent(openrouter, agentConfig)
  const updateSummarizerAgent = createUpdateSummarizerAgent(openrouter, agentConfig)
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
