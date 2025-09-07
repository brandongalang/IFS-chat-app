#!/usr/bin/env tsx
/*
  scripts/smoke-memory-v2.ts
  Writes a test event to the events ledger and reads it back.
*/
import { createClient as createSb } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const TEST_USER_ID = process.env.IFS_DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000'

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createSb(SUPABASE_URL, SERVICE_ROLE)

async function main() {
  const eventId = randomUUID()
  const now = new Date().toISOString()
  const payload = {
    event_id: eventId,
    schema_version: 1,
    user_id: TEST_USER_ID,
    entity_type: 'user',
    entity_id: TEST_USER_ID,
    type: 'system',
    op: null,
    section_anchor: null,
    file_path: null,
    rationale: 'smoke test',
    before_hash: null,
    after_hash: null,
    evidence_refs: [],
    lint: {},
    idempotency_key: null,
    transaction_id: null,
    tool_call_id: null,
    integrity_line_hash: 'hmac:smoke:' + now,
    integrity_salt_version: 'v1',
    status: 'committed',
  }

  const { error: insErr } = await sb.from('events').insert(payload)
  if (insErr) {
    console.error('Insert error:', insErr.message)
    process.exit(1)
  }

  const { data, error: selErr } = await sb
    .from('events')
    .select('event_id, ts, type, status')
    .eq('event_id', eventId)
    .single()

  if (selErr) {
    console.error('Select error:', selErr.message)
    process.exit(1)
  }

  console.log('Inserted event:', data)
}

main().catch((e) => { console.error(e); process.exit(1) })

