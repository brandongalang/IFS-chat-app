import { createAdminClient } from '@/lib/supabase/admin'
import { canonicalizeText, canonicalizeJson, hmacSha256Hex, generateEventId } from './canonicalize'

export type EventEntityType = 'user' | 'part' | 'relationship' | 'note'
export type EventType = 'observation' | 'action' | 'profile_update' | 'system' | 'audit'
export type EventOp = 'replace_section' | 'append_section' | 'append_item' | 'curate_items' | 'tombstone_section'

export interface LogEventInput {
  userId: string
  entityType: EventEntityType
  entityId?: string | null
  type: EventType
  op?: EventOp | null
  sectionAnchor?: string | null
  filePath?: string | null
  rationale?: string | null
  beforeHash?: string | null
  afterHash?: string | null
  evidenceRefs?: unknown[]
  lint?: Record<string, unknown>
  idempotencyKey?: string | null
  transactionId?: string | null
  toolCallId?: string | null
  integritySource?: { kind: 'text'; value: string } | { kind: 'json'; value: unknown }
  status?: 'pending' | 'committed' | 'failed'
}

export async function logEvent(input: LogEventInput & { eventId?: string }) {
  const sb = createAdminClient()
  const eventId = input.eventId || generateEventId()

  const secret = process.env.MEMORY_EVENTS_HMAC_SECRET || 'dev-only-secret'
  const integrityText = input.integritySource
    ? (input.integritySource.kind === 'text' ? canonicalizeText(input.integritySource.value) : canonicalizeJson(input.integritySource.value))
    : canonicalizeJson({ userId: input.userId, type: input.type, ts: new Date().toISOString() })
  const integrityLineHash = 'hmac:' + hmacSha256Hex(secret, integrityText)

  const payload = {
    event_id: eventId,
    user_id: input.userId,
    schema_version: 1,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    type: input.type,
    op: input.op ?? null,
    section_anchor: input.sectionAnchor ?? null,
    file_path: input.filePath ?? null,
    rationale: input.rationale ?? null,
    before_hash: input.beforeHash ?? null,
    after_hash: input.afterHash ?? null,
    evidence_refs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [],
    lint: input.lint ?? {},
    idempotency_key: input.idempotencyKey ?? null,
    transaction_id: input.transactionId ?? null,
    tool_call_id: input.toolCallId ?? null,
    integrity_line_hash: integrityLineHash,
    integrity_salt_version: 'v1',
    status: input.status ?? 'committed',
  }

  const { error } = await sb.from('events').insert(payload)
  if (error) throw error
  return { eventId }
}

