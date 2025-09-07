// Lightweight observability helpers for Memory v2 snapshot usage.
// This avoids adding dependencies; logs are structured JSON lines for easy grep or log shipping.

export type SnapshotKind = 'overview' | 'part_profile' | 'relationship_profile'
export type SnapshotStatus = 'hit' | 'miss' | 'error'

function nowIso() {
  try { return new Date().toISOString() } catch { return '' }
}

function toNumber(n: unknown): number | undefined {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : undefined
}

export function recordSnapshotUsage(kind: SnapshotKind, status: SnapshotStatus, extra?: {
  latencyMs?: number
  userId?: string
  partId?: string
  relId?: string
  error?: unknown
}) {
  try {
    const line = {
      ts: nowIso(),
      tag: 'MemoryV2',
      event: 'snapshot_usage',
      kind,
      status,
      latency_ms: toNumber(extra?.latencyMs),
      user_id: extra?.userId,
      part_id: extra?.partId,
      rel_id: extra?.relId,
      error: extra?.error ? String((extra.error as any)?.message || extra.error) : undefined,
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line))
  } catch {
    // best effort
  }
}

