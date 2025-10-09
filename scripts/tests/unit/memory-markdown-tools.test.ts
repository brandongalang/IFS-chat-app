import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function setupLocalStorageRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-tools-'))
  process.env.MEMORY_LOCAL_ROOT = root
  process.env.MEMORY_STORAGE_ADAPTER = 'local'
  process.env.NODE_ENV = 'production'
  process.env.IFS_DEV_MODE = 'false'
  process.env.NEXT_PUBLIC_IFS_DEV_MODE = 'false'
  return root
}

async function main() {
  console.log('Running memory markdown tools unit test...')

  const tempRoot = await setupLocalStorageRoot()
  const userId = 'a6a3197a-7d7d-4444-9ace-abcd1234abcd'
  const partId = 'b5b5c1b1-0f0f-4444-a1ce-abcdef123456'

  const { createMemoryMarkdownTools } = await import('../../../mastra/tools/memory-markdown-tools')
  const { getStorageAdapter, userOverviewPath, partProfilePath } = await import('../../../lib/memory/snapshots/fs-helpers')

  const tools = createMemoryMarkdownTools(userId)

  const readInitial = await tools.readOverviewSnapshot.execute({ context: { changeLogLimit: 3 }, runtime: { userId } })
  assert(readInitial.success, 'Initial overview read should succeed')
  assert(Array.isArray(readInitial.changeLog), 'Change log should be an array')
  assert(readInitial.changeLog.length >= 1, 'Overview should include initialization entry')

  const appendResult = await tools.appendOverviewChangeLog.execute({
    context: {
      digest: 'Session digest summary',
      source: 'unit-test',
      fingerprint: 'digest-1',
    },
    runtime: { userId },
  })
  assert.equal(appendResult.appended, true, 'First change log append should succeed')

  const appendDuplicate = await tools.appendOverviewChangeLog.execute({
    context: {
      digest: 'Session digest summary',
      source: 'unit-test',
      fingerprint: 'digest-1',
    },
    runtime: { userId },
  })
  assert.equal(appendDuplicate.appended, false, 'Duplicate fingerprint should be skipped')

  const writeSection = await tools.writeOverviewSection.execute({
    context: {
      section: 'current_focus',
      lines: ['Maintain exercise habit'],
      fingerprint: 'focus-1',
    },
    runtime: { userId },
  })
  assert.equal(writeSection.updated, true, 'Overview section update should succeed')

  const writeSectionDuplicate = await tools.writeOverviewSection.execute({
    context: {
      section: 'current_focus',
      lines: ['Maintain exercise habit'],
      fingerprint: 'focus-1',
    },
    runtime: { userId },
  })
  assert.equal(writeSectionDuplicate.updated, false, 'Duplicate overview entry should be skipped')

  const partNote = await tools.upsertPartNote.execute({
    context: {
      partId,
      name: 'Steady Coach',
      summary: 'Encouraged consistent pacing during project work',
      fingerprint: 'part-1',
      evidence: ['Observed steady breathing during stand-up'],
      status: 'active',
      category: 'manager',
    },
    runtime: { userId },
  })
  assert.equal(partNote.updated, true, 'Part note should be applied')

  const partNoteDuplicate = await tools.upsertPartNote.execute({
    context: {
      partId,
      name: 'Steady Coach',
      summary: 'Encouraged consistent pacing during project work',
      fingerprint: 'part-1',
    },
    runtime: { userId },
  })
  assert.equal(partNoteDuplicate.updated, false, 'Duplicate part note should be skipped')

  const overviewAfter = await tools.readOverviewSnapshot.execute({ context: { changeLogLimit: 10 }, runtime: { userId } })
  assert(overviewAfter.success, 'Follow-up overview read should succeed')
  const logEntry = overviewAfter.changeLog.find((entry: string) => entry.includes('[fp:digest-1]'))
  assert(logEntry, 'Overview change log should include fingerprint tag')

  const storage = await getStorageAdapter()
  const overviewPath = userOverviewPath(userId)
  const rawOverview = (await storage.getText(overviewPath)) ?? ''
  assert(rawOverview.includes('[fp:focus-1]'), 'Overview section should include fingerprint tag')

  const partPath = partProfilePath(userId, partId)
  const partText = (await storage.getText(partPath)) ?? ''
  assert(partText.includes('[fp:part-1]'), 'Part profile should include fingerprint tag')
  assert(partText.includes('Observed steady breathing'), 'Evidence entry should be recorded')

  await fs.rm(tempRoot, { recursive: true, force: true })

  console.log('Memory markdown tools unit test passed.')
}

main().catch((error) => {
  console.error('Memory markdown tools unit test failed:', error)
  process.exit(1)
})
