export { createMastra, getMastra, mastra } from './mastra'

// Minimal Mastra CLI shim to point tooling at the code-defined bootstrap.
const configObject = {
  name: 'ifs-therapy-companion',
  agents: {
    directory: './mastra/agents',
  },
  tools: {
    directory: './mastra/tools',
  },
  workflows: {
    directory: './mastra/workflows',
  },
}

export default configObject
