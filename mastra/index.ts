import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { resolveChatModel, resolveAgentModel } from '@/config/model'
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

const chatConfig: AgentRuntimeConfig = {
  modelId: resolveChatModel(),
  temperature: ENV.IFS_TEMPERATURE,
}

const agentConfig: AgentRuntimeConfig = {
  modelId: resolveAgentModel(),
  temperature: ENV.IFS_TEMPERATURE,
}

if (process.env.NODE_ENV !== 'test') {
  console.info('[Mastra] Agent configuration', {
    chatModelId: chatConfig.modelId,
    agentModelId: agentConfig.modelId,
    temperature: agentConfig.temperature,
    baseURL: OPENROUTER_API_BASE_URL,
  })
}

let mastraInstance: any = null

export function createMastra(profile: Profile = null) {
  const userId = profile?.userId
  const insightGeneratorAgent = createInsightGeneratorAgent(userId, agentConfig)
  const inboxObservationAgent = createInboxObservationAgent(profile, agentConfig)

  return new Mastra({
    logger: new PinoLogger({
      name: 'IFS-Therapy-App',
      level: 'info',
    }),
    // Expose agents and workflows to the Mastra runtime
    agents: {
      ifsAgent: createIfsAgent(profile, chatConfig),
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
