import { Agent } from '@mastra/core'
import type { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ENV } from '@/config/env'
import { resolveModel } from '@/config/model'
import { getPartTools } from '../tools/part-tools.mastra'
import { assessmentTools } from '../tools/assessment-tools'
import { proposalTools } from '../tools/proposal-tools'
import { evidenceTools } from '../tools/evidence-tools'
import { stubTools } from '../tools/stub-tools'
import { memoryTools } from '../tools/memory-tools'
import { updateSyncTools } from '../tools/update-sync-tools'
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
      ...assessmentTools, // Confidence assessment tool
      ...proposalTools, // Split/Merge proposal workflow
      ...evidenceTools, // Evidence and pattern tools
      ...stubTools, // Stub creation tools
      ...memoryTools, // Memory and conversation search tools
      ...updateSyncTools, // Sync unprocessed updates from Supabase
    },
  })
}
