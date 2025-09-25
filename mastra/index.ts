import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { createIfsAgent } from './agents/ifs-agent'
import { insightGeneratorAgent } from './agents/insight-generator'
import { generateInsightWorkflow } from './workflows/generate-insight-workflow'
import { createUpdateSummarizerAgent } from './agents/update-summarizer'

type Profile = Parameters<typeof createIfsAgent>[0]

type RegisteredAgents = {
  ifsAgent: ReturnType<typeof createIfsAgent>
  insightGeneratorAgent: typeof insightGeneratorAgent
  updateSummarizerAgent: ReturnType<typeof createUpdateSummarizerAgent>
}

type RegisteredLegacyWorkflows = Record<string, never>
type RegisteredWorkflows = {
  generateInsightWorkflow: typeof generateInsightWorkflow
}

type MastraInstance = Mastra<RegisteredAgents, RegisteredLegacyWorkflows, RegisteredWorkflows>

let mastraInstance: MastraInstance | null = null

export function createMastra(profile: Profile = null): MastraInstance {
  return new Mastra<RegisteredAgents, RegisteredLegacyWorkflows, RegisteredWorkflows>({
    logger: new PinoLogger({
      name: 'IFS-Therapy-App',
      level: 'info',
    }),
    agents: {
      ifsAgent: createIfsAgent(profile),
      insightGeneratorAgent,
      updateSummarizerAgent: createUpdateSummarizerAgent(),
    },
    workflows: {
      generateInsightWorkflow,
    },
    // Additional Mastra primitives (telemetry, storage, etc.) can be configured here as needed.
  })
}

export function getMastra(profile: Profile = null): MastraInstance {
  if (!mastraInstance) {
    mastraInstance = createMastra(profile)
  }
  return mastraInstance
}

// Export a default Mastra instance for the Mastra CLI dev entry
// The CLI expects: export const mastra = new Mastra({ ... })
export const mastra = getMastra()
