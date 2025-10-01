const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(candidate: unknown): candidate is string {
  return typeof candidate === 'string' && UUID_REGEX.test(candidate.trim())
}

export function shouldPersistInboxEvent(subjectId: unknown, source: unknown): boolean {
  return source === 'supabase' && isValidUuid(subjectId)
}
