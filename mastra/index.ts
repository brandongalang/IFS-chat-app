import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { createIfsAgent } from './agents/ifs-agent'

export const mastra = new Mastra({
  logger: new PinoLogger({
    name: 'IFS-Therapy-App',
    level: 'info',
  }),
  agents: {
    ifsAgent: createIfsAgent(null),
  },
})
