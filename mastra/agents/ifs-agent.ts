import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
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
