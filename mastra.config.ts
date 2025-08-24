import { config } from '@mastra/core'

export default config({
  name: 'ifs-therapy-companion',
  agents: {
    directory: './mastra/agents',
  },
  tools: {
    directory: './mastra/tools',
  },
  providers: {
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
    },
  },
  db: {
    provider: 'supabase',
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    apiKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
})
