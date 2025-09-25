import 'server-only'

import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { getPartTools } from '../tools/part-tools.mastra'
import { assessmentTools } from '../tools/assessment-tools'
import { proposalTools } from '../tools/proposal-tools'
import { evidenceTools } from '../tools/evidence-tools'
import { stubTools } from '../tools/stub-tools'
import { memoryTools } from '../tools/memory-tools'
import { updateSyncTools } from '../tools/update-sync-tools'
import { generateSystemPrompt } from './ifs_agent_prompt'

// Configure OpenRouter provider through Mastra
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  // Use env-driven base URL; default to OpenRouter cloud if unset
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
})

type Profile = { name?: string; bio?: string, userId?: string } | null

export function createIfsAgent(profile: Profile) {
  const userId = profile?.userId
  return new Agent({
    name: 'ifs-companion',
    instructions: generateSystemPrompt(profile),
    model: openrouter('z-ai/glm-4.5-air'),
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
