import { Agent } from '@mastra/core'
import type { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ENV } from '@/config/env'
import { resolveModel } from '@/config/model'
import { getPartTools } from '../tools/part-tools.mastra'
import { createAssessmentTools } from '../tools/assessment-tools'
import { createProposalTools } from '../tools/proposal-tools'
import { createEvidenceTools } from '../tools/evidence-tools'
import { createStubTools } from '../tools/stub-tools'
import { createMemoryTools } from '../tools/memory-tools'
import { createUpdateSyncTools } from '../tools/update-sync-tools'
import { createPendingUpdateTools } from '../tools/update-sync'
import { createRollbackTools } from '../tools/rollback-tools'
import { generateSystemPrompt } from './ifs_agent_prompt'

type OpenRouterProvider = ReturnType<typeof createOpenRouter>

export type AgentModelConfig = {
  modelId?: string
  temperature?: number
}

type Profile = { name?: string; bio?: string; userId?: string } | null

export function createIfsAgent(
  profile: Profile,
  openrouter: OpenRouterProvider,
  overrides: AgentModelConfig = {},
) {
  const userId = profile?.userId
  const modelId = overrides.modelId ?? resolveModel(ENV.IFS_MODEL)
  const temperature = overrides.temperature ?? ENV.IFS_TEMPERATURE

  const modelSettings =
    typeof temperature === 'number'
      ? ({
          extraBody: {
            temperature,
          },
        } as const)
      : undefined

  return new Agent({
    name: 'ifs-companion',
    instructions: generateSystemPrompt(profile),
    model: openrouter(modelId, modelSettings),
    tools: {
      ...getPartTools(userId), // Part management tools
      ...createAssessmentTools(userId), // Confidence assessment tool
      ...createProposalTools(userId), // Split/Merge proposal workflow
      ...createEvidenceTools(userId), // Evidence and pattern tools
      ...createStubTools(userId), // Stub creation tools
      ...createMemoryTools(userId), // Memory and conversation search tools
      ...createUpdateSyncTools(userId), // Unprocessed updates overview
      ...createPendingUpdateTools(userId), // Pending updates fetcher
      ...createRollbackTools(userId), // Rollback capabilities
    },
  })
}
