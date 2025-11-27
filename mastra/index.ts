import { z } from 'zod'
import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'

import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { resolveChatModel, resolveAgentModel } from '@/config/model'
import { createIfsAgent } from './agents/ifs-agent'
import { createInsightGeneratorAgent } from './agents/insight-generator'
import { createUpdateSummarizerAgent } from './agents/update-summarizer'
import { createGenerateInsightWorkflow } from './workflows/generate-insight-workflow'
import { createInboxObservationAgent } from './agents/inbox-observation'
import { createUnifiedInboxAgent } from './agents/unified-inbox'
import { AgentRuntimeConfigSchema, ProfileSchema } from './schemas'

type Profile = z.infer<typeof ProfileSchema>
type AgentRuntimeConfig = z.infer<typeof AgentRuntimeConfigSchema>

const chatConfig: AgentRuntimeConfig = AgentRuntimeConfigSchema.parse({
  modelId: resolveChatModel(),
  temperature: ENV.IFS_TEMPERATURE,
})

const agentConfig: AgentRuntimeConfig = AgentRuntimeConfigSchema.parse({
  modelId: resolveAgentModel(),
  temperature: ENV.IFS_TEMPERATURE,
})

if (process.env.NODE_ENV !== 'test') {
  console.info('[Mastra] Agent configuration', {
    chatModelId: chatConfig.modelId,
    agentModelId: agentConfig.modelId,
    temperature: agentConfig.temperature,
    baseURL: OPENROUTER_API_BASE_URL,
  })
}

let mastraInstance: Mastra | null = null

export function createMastra(profile: Profile = null): Mastra {
  const userId = profile?.userId
  const insightGeneratorAgent = createInsightGeneratorAgent(userId, agentConfig)
  const inboxObservationAgent = createInboxObservationAgent(profile, agentConfig)
  const unifiedInboxAgent = createUnifiedInboxAgent(profile, agentConfig)

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
      unifiedInboxAgent,
    },
    workflows: {
      generateInsightWorkflow: createGenerateInsightWorkflow(insightGeneratorAgent),
    },
    // Optional telemetry config can be added here when needed
    // telemetry: { /* configure telemetry here if desired */ },
  })
}

export function getMastra(profile: Profile = null): Mastra {
  // For user-scoped calls, create a fresh instance to avoid cross-user state.
  if (profile) {
    return createMastra(profile)
  }
  // For CLI/dev use, keep a default cached instance.
  if (!mastraInstance) {
    mastraInstance = createMastra(null)
  }
  return mastraInstance
}

// Export a default Mastra instance for the Mastra CLI dev entry
// The CLI expects: export const mastra = new Mastra({ ... })
export const mastra = getMastra()
