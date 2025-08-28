import { Agent } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { partTools } from '../tools/part-tools'
import { rollbackTools } from '../tools/rollback-tools'
import { assessmentTools } from '../tools/assessment-tools'
import { proposalTools } from '../tools/proposal-tools'
import { evidenceTools } from '../tools/evidence-tools'
import { generateSystemPrompt } from './ifs_agent_prompt'

// Configure OpenRouter provider through Mastra
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
})

type Profile = { name?: string; bio?: string } | null

export function createIfsAgent(profile: Profile) {
  return new Agent({
    name: 'ifs-companion',
    instructions: generateSystemPrompt(profile),
    model: openrouter('z-ai/glm-4.5'),
    tools: {
      ...partTools, // Part management tools
      ...rollbackTools, // Rollback/undo tools
      ...assessmentTools, // Confidence assessment tool
      ...proposalTools, // Split/Merge proposal workflow
      ...evidenceTools, // Evidence and pattern tools
    },
  })
}