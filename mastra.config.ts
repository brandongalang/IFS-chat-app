import { env } from './config/env'

const configObject = {
  name: 'ifs-therapy-companion',
  agents: {
    directory: './mastra/agents',
  },
  tools: {
    directory: './mastra/tools',
  },
  providers: {
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY,
    },
  },
  db: {
    provider: 'supabase',
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    apiKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
}

export default configObject
