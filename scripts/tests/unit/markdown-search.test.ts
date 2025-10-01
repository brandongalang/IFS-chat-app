import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function setupFixture() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-search-'))
  process.env.MEMORY_LOCAL_ROOT = tempRoot
  process.env.MEMORY_STORAGE_ADAPTER = 'local'

  const userRoot = path.join(tempRoot, 'users', 'user-123')
  await fs.mkdir(path.join(userRoot, 'sessions'), { recursive: true })
  await fs.mkdir(path.join(userRoot, 'parts', 'part-1'), { recursive: true })

  await fs.writeFile(
    path.join(userRoot, 'overview.md'),
    ['# Overview', '', 'Self energy rising in daily check-ins.', 'Focus on morning routines.'].join('\n'),
    'utf8',
  )

  await fs.writeFile(
    path.join(userRoot, 'parts', 'part-1', 'profile.md'),
    ['# Guardian', '', 'Protective stance when under stress.', 'Prefers evening reflections.'].join('\n'),
    'utf8',
  )

  await fs.writeFile(path.join(userRoot, 'sessions', 'notes.txt'), 'Non-markdown file', 'utf8')

  return tempRoot
}

async function main() {
  const tempRoot = await setupFixture()
  const modulePath = '@/lib/inbox/search/markdown?test=' + Date.now()
  const { listMarkdownFiles, searchMarkdown, readMarkdown } = await import(modulePath)

  const listed = await listMarkdownFiles({ userId: 'user-123' })

  assert.equal(listed.length, 2, 'Expected two markdown files')
  const overview = listed.find((item) => item.path === 'overview.md')
  assert.ok(overview, 'overview.md missing from list results')
  assert.ok(overview?.size > 0, 'overview file size should be > 0')

  const globbed = await listMarkdownFiles({ userId: 'user-123', glob: 'parts/**/*.md' })
  assert.equal(globbed.length, 1, 'Expected glob to filter down to part markdown only')
  assert.equal(globbed[0]?.path, 'parts/part-1/profile.md')

  const substringSearch = await searchMarkdown({ userId: 'user-123', pattern: 'self energy' })
  assert.equal(substringSearch.matches.length, 1, 'Expected substring search to return one match')
  assert.equal(substringSearch.matches[0]?.path, 'overview.md')
  assert.equal(substringSearch.matches[0]?.line, 3)

  const regexSearch = await searchMarkdown({ userId: 'user-123', pattern: 'evening', regex: true })
  assert.equal(regexSearch.matches.length, 1, 'Expected regex search to return one match')
  assert.equal(regexSearch.matches[0]?.path, 'parts/part-1/profile.md')

  const chunk = await readMarkdown({ userId: 'user-123', path: 'overview.md', offset: 0, limit: 128 })
  assert.equal(chunk.path, 'overview.md')
  assert.equal(chunk.offset, 0)
  assert.ok(chunk.data.length > 0)
  assert.equal(chunk.hasMore, false)

  await fs.rm(tempRoot, { recursive: true, force: true })
}

void main()
