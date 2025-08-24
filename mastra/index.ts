import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { ifsAgent } from './agents/ifs-agent.js'

export const mastra = new Mastra({
  logger: new PinoLogger({
    name: 'IFS-Therapy-App',
    level: 'info',
  }),
  agents: {
    ifsAgent,
  },
})