import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ENV, OPENROUTER_API_BASE_URL, env } from '@/config/env'
import { resolveModel } from '@/config/model'
import { getPartTools } from '../tools/part-tools.mastra'
import { createAssessmentTools } from '../tools/assessment-tools'
import { createProposalTools } from '../tools/proposal-tools'
import { createEvidenceTools } from '../tools/evidence-tools'
import { createStubTools } from '../tools/stub-tools'
import { createMemoryTools } from '../tools/memory-tools'
import { createMarkdownTools } from '../tools/markdown-tools'
import { createMarkdownWriteTools } from '../tools/markdown-write-tools'
import { generateSystemPrompt, type IFSAgentProfile } from './ifs_agent_prompt'

export type AgentModelConfig = {
  modelId?: string
  baseURL?: string
  temperature?: number
}

type Profile = IFSAgentProfile

export function createIfsAgent(profile: Profile, overrides: AgentModelConfig = {}) {
  const userId = profile?.userId
  const modelId = overrides.modelId ?? resolveModel(ENV.IFS_MODEL)
  const temperature = overrides.temperature ?? ENV.IFS_TEMPERATURE
  const baseURL = overrides.baseURL ?? OPENROUTER_API_BASE_URL

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

  const markdownTools = env.ifsMarkdownContextEnabled ? createMarkdownTools(userId ?? null) : null
  const markdownWriteTools = env.ifsMarkdownContextEnabled ? createMarkdownWriteTools(userId ?? null) : null

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
      ...(markdownTools ?? {}),
      ...(markdownWriteTools ?? {}),
    },
  })
}
