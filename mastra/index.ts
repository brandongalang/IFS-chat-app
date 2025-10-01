import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { ENV } from '@/config/env'
import { resolveModel } from '@/config/model'
import { createIfsAgent } from './agents/ifs-agent'
import { createInsightGeneratorAgent } from './agents/insight-generator'
import { createUpdateSummarizerAgent } from './agents/update-summarizer'
import { createGenerateInsightWorkflow } from './workflows/generate-insight-workflow'
import { createInboxObservationAgent } from './agents/inbox-observation'

type Profile = Parameters<typeof createIfsAgent>[0]

type AgentRuntimeConfig = {
  modelId: string
  baseURL?: string
  temperature: number
}

const defaultModelId = resolveModel(ENV.IFS_MODEL)
const agentConfig: AgentRuntimeConfig = {
  modelId: defaultModelId,
  baseURL: ENV.IFS_PROVIDER_BASE_URL ?? ENV.OPENROUTER_BASE_URL,
  temperature: ENV.IFS_TEMPERATURE,
}

if (process.env.NODE_ENV !== 'test') {
  console.info('[Mastra] Agent configuration', {
    modelId: agentConfig.modelId,
    temperature: agentConfig.temperature,
    baseURL: agentConfig.baseURL ?? 'https://openrouter.ai/api/v1',
  })
}

let mastraInstance: any = null

export function createMastra(profile: Profile = null) {
  const insightGeneratorAgent = createInsightGeneratorAgent(agentConfig)
  const inboxObservationAgent = createInboxObservationAgent(agentConfig)

  return new Mastra({
    logger: new PinoLogger({
      name: 'IFS-Therapy-App',
      level: 'info',
    }),
    // Expose agents and workflows to the Mastra runtime
    agents: {
      ifsAgent: createIfsAgent(profile, agentConfig),
      insightGeneratorAgent,
      updateSummarizerAgent: createUpdateSummarizerAgent(agentConfig),
      inboxObservationAgent,
    },
    workflows: {
      generateInsightWorkflow: createGenerateInsightWorkflow(insightGeneratorAgent as any),
    },
    // Optional telemetry config can be added here when needed
    // telemetry: { /* configure telemetry here if desired */ },
  }) as any
}

export function getMastra(profile: Profile = null) {
  // For user-scoped calls, create a fresh instance to avoid cross-user state.
  if (profile) {
    return createMastra(profile)
  }
  // For CLI/dev use, keep a default cached instance.
  if (!mastraInstance) {
    mastraInstance = createMastra(null)
  }
  return mastraInstance as any
}

// Export a default Mastra instance for the Mastra CLI dev entry
// The CLI expects: export const mastra = new Mastra({ ... })
export const mastra = getMastra()
