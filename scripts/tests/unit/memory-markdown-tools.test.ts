import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function setupLocalStorageRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-tools-'))
  process.env.MEMORY_LOCAL_ROOT = root
  process.env.MEMORY_STORAGE_ADAPTER = 'local'
  process.env.NODE_ENV = 'test'
  process.env.IFS_DEV_MODE = 'false'
  process.env.NEXT_PUBLIC_IFS_DEV_MODE = 'false'
  return root
}

async function main() {
  console.log('Running memory markdown tools unit test...')

  const tempRoot = await setupLocalStorageRoot()
  const userId = 'a6a3197a-7d7d-4444-9ace-abcd1234abcd'

  const { createMemoryMarkdownTools } = await import('../../../mastra/tools/memory-markdown-tools')

  const tools = createMemoryMarkdownTools(userId)

  const readInitial = await tools.readOverviewSnapshot.execute({
    context: { changeLogLimit: 5 },
    runtime: { userId },
  })

  assert(readInitial.success, 'Initial overview read should succeed')
  assert(Array.isArray(readInitial.changeLog), 'Change log should be an array')
  assert(readInitial.changeLog.length >= 1, 'Overview should include initialization entry')
  assert(readInitial.sections, 'Overview sections should be returned')

  await fs.rm(tempRoot, { recursive: true, force: true })

  console.log('Memory markdown tools unit test passed.')
}

main().catch((error) => {
  console.error('Memory markdown tools unit test failed:', error)
  process.exit(1)
})
