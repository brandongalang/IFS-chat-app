import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function setupStorageRoot() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'overview-loader-'))
  process.env.MEMORY_LOCAL_ROOT = tempRoot
  process.env.MEMORY_STORAGE_ADAPTER = 'local'
  return tempRoot
}

async function main() {
  console.log('Running overview loader unit test...')

  const tempRoot = await setupStorageRoot()
  const userId = 'user-overview'

  const { loadOverviewSnapshot, formatOverviewFragments } = await import('../../../lib/memory/overview')

  const snapshot = await loadOverviewSnapshot(userId)
  assert(snapshot, 'Expected snapshot to load')
  assert.equal(snapshot?.created, true, 'First load should scaffold overview file')
  assert(snapshot?.fragments.length && snapshot.fragments.length > 0, 'Fragments should not be empty')

  const identity = snapshot?.fragments.find((fragment) => fragment.anchor === 'identity v1')
  assert(identity, 'Identity fragment missing')
  assert(identity?.heading.includes('Identity'), 'Identity heading mismatch')

  const formatted = formatOverviewFragments(snapshot?.fragments ?? [])
  assert(formatted.includes('### Identity'), 'Formatted overview should include headings')
  assert(formatted.includes('[//]: # (anchor: identity v1)'), 'Formatted overview should preserve anchors')

  const secondLoad = await loadOverviewSnapshot(userId)
  assert(secondLoad, 'Expected snapshot reload to succeed')
  assert.equal(secondLoad?.created, false, 'Second load should not recreate overview file')

  await fs.rm(tempRoot, { recursive: true, force: true })

  console.log('Overview loader unit test passed.')
}

main().catch((error) => {
  console.error('Overview loader unit test failed:', error)
  process.exit(1)
})
