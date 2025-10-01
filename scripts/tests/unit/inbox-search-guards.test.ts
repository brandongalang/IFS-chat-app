import assert from 'node:assert/strict'

async function main() {
  const modulePath = '@/lib/inbox/search/guards?test=' + Date.now()
  const {
    normalizeMatchLimit,
    normalizePageSize,
    normalizeTimeoutMs,
    normalizeContextLines,
    buildGuardedSearchConfig,
    MarkdownSearchValidationError,
  } = await import(modulePath)

  assert.equal(normalizeMatchLimit(), 50)
  assert.equal(normalizeMatchLimit(0), 1)
  assert.equal(normalizeMatchLimit(200), 50)

  assert.equal(normalizePageSize(), 8192)
  assert.equal(normalizePageSize(256), 512)
  assert.equal(normalizePageSize(8192), 8192)

  assert.equal(normalizeTimeoutMs(), 500)
  assert.equal(normalizeTimeoutMs(-10), 500)
  assert.equal(normalizeTimeoutMs(10_000), 2000)

  const context = normalizeContextLines(-1, 10)
  assert.deepEqual(context, { before: 2, after: 5 })

  const guarded = buildGuardedSearchConfig({
    pattern: 'protect',
    regex: true,
    flags: 'ms',
    ignoreCase: false,
    maxMatches: 80,
    timeoutMs: 1000,
    contextBefore: 1,
    contextAfter: 3,
  })

  assert.equal(guarded.regex, true)
  assert.equal(guarded.flags, 'ms')
  assert.equal(guarded.maxMatches, 50)
  assert.equal(guarded.timeoutMs, 1000)
  assert.deepEqual({ before: guarded.contextBefore, after: guarded.contextAfter }, { before: 1, after: 3 })

  let threw = false
  try {
    buildGuardedSearchConfig({ pattern: '(', regex: true })
  } catch (error) {
    threw = error instanceof MarkdownSearchValidationError
  }

  assert.equal(threw, true, 'Expected invalid regex to throw MarkdownSearchValidationError')
}

void main()
