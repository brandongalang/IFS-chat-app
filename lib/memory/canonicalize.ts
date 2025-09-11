import { createHmac, createHash, randomUUID } from 'node:crypto'

// Canonicalize text content for integrity HMAC: LF newlines, trim trailing spaces, ensure final newline
export function canonicalizeText(input: string): string {
  // Normalize CRLF/CR to LF
  let s = input.replace(/\r\n?/g, '\n')
  // Trim trailing whitespace per line
  s = s.split('\n').map(line => line.replace(/[\t ]+$/g, '')).join('\n')
  // Ensure single trailing newline
  if (!s.endsWith('\n')) s += '\n'
  return s
}

// Deterministic JSON canonicalization (stable key order, no extra whitespace)
export function canonicalizeJson(value: unknown): string {
  const seen = new WeakSet<object>()
  const sort = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v
    const obj = v as Record<string, unknown>
    if (seen.has(obj)) return null
    seen.add(obj)
    if (Array.isArray(obj)) return obj.map(sort)
    const keys = Object.keys(obj).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) out[k] = sort(obj[k])
    return out
  }
  const normalized = sort(value)
  return JSON.stringify(normalized)
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

export function hmacSha256Hex(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input, 'utf8').digest('hex')
}

export function generateEventId(): string {
  // Use UUID for now; ULID can be added later. Keep text type in DB.
  return randomUUID()
}

