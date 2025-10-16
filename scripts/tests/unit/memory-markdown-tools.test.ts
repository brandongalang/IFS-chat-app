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
  const partId = 'b5b5c1b1-0f0f-4444-a1ce-abcdef123456'

  const { createMemoryMarkdownTools } = await import('../../../mastra/tools/memory-markdown-tools')
  const { getStorageAdapter, userOverviewPath, partProfilePath } = await import('../../../lib/memory/snapshots/fs-helpers')
  const { readPartProfileSections } = await import('../../../lib/memory/read')

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
  const overviewFingerprintCount = (rawOverview.match(/\[fp:digest-1\]/g) ?? []).length
  assert.equal(overviewFingerprintCount, 1, 'Overview change log should only include one digest fingerprint')

  const partPath = partProfilePath(userId, partId)
  const partText = (await storage.getText(partPath)) ?? ''
  assert(partText.includes('[fp:part-1]'), 'Part profile should include fingerprint tag')
  assert(partText.includes('Observed steady breathing'), 'Evidence entry should be recorded')
  const partSections = await readPartProfileSections(userId, partId)
  const partChangeLog = partSections?.['change_log v1']?.text ?? ''
  const partChangeLogFingerprintCount = (partChangeLog.match(/\[fp:part-1\]/g) ?? []).length
  assert.equal(partChangeLogFingerprintCount, 1, 'Part change log should only include one fingerprint entry')

  // Test createPartProfileMarkdown tool
  const newPartId = 'c6c6d2c2-1f1f-5555-b2ce-abcdef234567'
  const createResult1 = await tools.createPartProfileMarkdown.execute({
    context: {
      partId: newPartId,
      name: 'Anxious Planner',
      status: 'emerging',
      category: 'firefighter',
    },
    runtime: { userId },
  })
  assert.equal(createResult1.created, true, 'First createPartProfileMarkdown should report created: true')
  assert(createResult1.path.includes(newPartId), 'Created path should include partId')

  const createResult2 = await tools.createPartProfileMarkdown.execute({
    context: {
      partId: newPartId,
      name: 'Anxious Planner',
    },
    runtime: { userId },
  })
  assert.equal(createResult2.created, false, 'Second createPartProfileMarkdown should report created: false')
  assert.equal(createResult2.path, createResult1.path, 'Path should be consistent')

  const newPartPath = partProfilePath(userId, newPartId)
  const newPartExists = await storage.exists(newPartPath)
  assert.equal(newPartExists, true, 'New part profile file should exist')

  await fs.rm(tempRoot, { recursive: true, force: true })

  console.log('Memory markdown tools unit test passed.')
}

main().catch((error) => {
  console.error('Memory markdown tools unit test failed:', error)
  process.exit(1)
})
