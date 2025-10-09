import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const personaId = '11111111-1111-1111-1111-111111111111'

async function setupFixture() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-write-'))
  process.env.MEMORY_LOCAL_ROOT = tempRoot
  process.env.MEMORY_STORAGE_ADAPTER = 'local'

  const userRoot = path.join(tempRoot, 'users', personaId)
  await fs.mkdir(path.join(userRoot, 'parts', 'alpha'), { recursive: true })

  const overview = [
    '# Overview',
    '',
    '## Summary',
    '<!-- @anchor: summary -->',
    'Initial summary line.',
    '',
    '## History',
    '<!-- @anchor: history -->',
    'Origins of this journey.',
  ].join('\n')

  await fs.writeFile(path.join(userRoot, 'overview.md'), overview, 'utf8')

  return { tempRoot, userRoot }
}

async function main() {
  const { tempRoot, userRoot } = await setupFixture()

  const modulePath = '@/mastra/tools/markdown-write-tools?test=' + Date.now()
  const { createMarkdownWriteTools } =
    (await import(modulePath)) as typeof import('@/mastra/tools/markdown-write-tools')

  const tools = createMarkdownWriteTools()
  const previewTool = tools.previewMarkdownSectionPatch
  const writeTool = tools.writeMarkdownSection
  const createTool = tools.createMarkdownFile

  const preview = await previewTool.execute({
    context: {
      path: 'overview.md',
      anchor: 'summary',
      mode: 'append',
      text: '- Added insight',
    },
    runtime: {},
  })

  assert.equal(preview.success, true)
  assert.ok(preview.preview.includes('- Added insight'))
  assert.ok(preview.warnings.length >= 0)

  const writeResult = await writeTool.execute({
    context: {
      path: 'overview.md',
      anchor: 'summary',
      mode: 'append',
      text: '- Added insight',
      expectedBeforeHash: preview.beforeHash,
    },
    runtime: {},
  })

  assert.equal(writeResult.success, true)
  assert.ok(writeResult.warnings.length >= 0)

  const written = await fs.readFile(path.join(userRoot, 'overview.md'), 'utf8')
  assert.ok(written.includes('- Added insight'), 'Appended text missing from overview')

  const conflict = await writeTool.execute({
    context: {
      path: 'overview.md',
      anchor: 'summary',
      mode: 'append',
      text: '- Second insight',
      expectedBeforeHash: preview.beforeHash,
    },
    runtime: {},
  })

  assert.equal(conflict.success, false)
  assert.equal(conflict.conflict, true)
  assert.ok(typeof conflict.currentHash === 'string')

  const created = await createTool.execute({
    context: {
      path: 'parts/alpha/profile.md',
      template: 'blank',
      initialText: '# Alpha\n\n## Profile\n<!-- @anchor: profile -->\nStarting point.',
    },
    runtime: {},
  })

  assert.equal(created.success, true)
  const profile = await fs.readFile(path.join(userRoot, 'parts/alpha/profile.md'), 'utf8')
  assert.ok(profile.includes('# Alpha'))

  await fs.rm(tempRoot, { recursive: true, force: true })
}

void main()
