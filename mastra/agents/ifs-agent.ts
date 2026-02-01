import { z } from 'zod'
import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { resolveChatModel } from '@/config/model'
import { getPartTools } from '../tools/part-tools'
import { createAssessmentTools } from '../tools/assessment-tools'
import { createProposalTools } from '../tools/proposal-tools'
import { createEvidenceTools } from '../tools/evidence-tools'
import { createMemoryTools } from '../tools/memory-tools'
import { createUpdateSyncTools } from '../tools/update-sync-tools'
import { createTherapyTools } from '../tools/therapy-tools'
import { generateSystemPrompt, type IFSAgentProfile } from './ifs_agent_prompt'
import { AgentModelConfigSchema } from '../schemas'

export type AgentModelConfig = z.infer<typeof AgentModelConfigSchema>

type Profile = IFSAgentProfile

export function createIfsAgent(profile: Profile, overrides: AgentModelConfig = {}) {
  const config = AgentModelConfigSchema.parse(overrides)
  const userId = profile?.userId
  const modelId = config.modelId ?? resolveChatModel()
  const temperature = config.temperature ?? ENV.IFS_TEMPERATURE
  const baseURL = config.baseURL ?? OPENROUTER_API_BASE_URL

  const openrouter = createOpenRouter({
    apiKey: ENV.OPENROUTER_API_KEY,
    baseURL,
  })

  const modelSettings =
    typeof temperature === 'number'
      ? ({
          extraBody: {
            temperature,
          },
        } as const)
      : undefined

  const updateSyncTools = createUpdateSyncTools(userId)
  const therapyTools = createTherapyTools(userId ?? undefined)

  return new Agent({
    name: 'ifs-companion',
    instructions: generateSystemPrompt(profile),
    model: openrouter(modelId, modelSettings),
    tools: {
      ...getPartTools(userId), // Part management tools
      ...createAssessmentTools(userId), // Confidence assessment tool
      ...createProposalTools(userId), // Split/Merge proposal workflow
      ...createEvidenceTools(userId), // Evidence and pattern tools
      ...createMemoryTools(userId), // Memory and conversation search tools
      ...updateSyncTools, // Update sync workflow tools
      ...therapyTools, // PRD schema therapy data tools
    },
  })
}
