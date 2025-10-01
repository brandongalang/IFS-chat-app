import assert from 'node:assert/strict'

async function main() {
  const modulePath = '@/app/api/inbox/events/helpers?test=' + Date.now()
  const { shouldPersistInboxEvent, isValidUuid } = await import(modulePath)

  assert.equal(isValidUuid('550e8400-e29b-41d4-a716-446655440000'), true, 'Expected uuid helper to validate canonical UUID')
  assert.equal(isValidUuid('not-a-uuid'), false, 'Expected uuid helper to reject invalid strings')

  assert.equal(
    shouldPersistInboxEvent('550e8400-e29b-41d4-a716-446655440000', 'supabase'),
    true,
    'Expected supabase + uuid to persist'
  )

  assert.equal(
    shouldPersistInboxEvent('550e8400-e29b-41d4-a716-446655440000', 'fallback'),
    false,
    'Expected fallback source to skip persistence'
  )

  assert.equal(
    shouldPersistInboxEvent('not-a-uuid', 'supabase'),
    false,
    'Expected invalid uuid to skip persistence'
  )
}

void main()
