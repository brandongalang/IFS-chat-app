import { ObservationTelemetryClient } from './types'

export const MARKDOWN_DEFAULT_MATCH_LIMIT = 50
export const MARKDOWN_MAX_MATCH_LIMIT = 50
export const MARKDOWN_MIN_MATCH_LIMIT = 1

export const MARKDOWN_DEFAULT_PAGE_SIZE = 8 * 1024
export const MARKDOWN_MAX_PAGE_SIZE = 8 * 1024
export const MARKDOWN_MIN_PAGE_SIZE = 512

export const MARKDOWN_DEFAULT_TIMEOUT_MS = 500
export const MARKDOWN_MAX_TIMEOUT_MS = 2_000

export const MARKDOWN_DEFAULT_CONTEXT_BEFORE = 2
export const MARKDOWN_DEFAULT_CONTEXT_AFTER = 2
export const MARKDOWN_MAX_CONTEXT_LINES = 5

export class MarkdownSearchValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarkdownSearchValidationError'
  }
}

export interface GuardedSearchConfig {
  maxMatches: number
  timeoutMs: number
  contextBefore: number
  contextAfter: number
  ignoreCase: boolean
  regex: boolean
  flags: string | undefined
}

export function normalizeMatchLimit(requested?: number): number {
  if (typeof requested !== 'number' || Number.isNaN(requested)) {
    return MARKDOWN_DEFAULT_MATCH_LIMIT
  }

  const value = Math.floor(requested)
  if (value < MARKDOWN_MIN_MATCH_LIMIT) {
    return MARKDOWN_MIN_MATCH_LIMIT
  }
  if (value > MARKDOWN_MAX_MATCH_LIMIT) {
    return MARKDOWN_MAX_MATCH_LIMIT
  }
  return value
}

export function normalizePageSize(requested?: number): number {
  if (typeof requested !== 'number' || Number.isNaN(requested)) {
    return MARKDOWN_DEFAULT_PAGE_SIZE
  }
  const value = Math.floor(requested)
  if (value < MARKDOWN_MIN_PAGE_SIZE) {
    return MARKDOWN_MIN_PAGE_SIZE
  }
  if (value > MARKDOWN_MAX_PAGE_SIZE) {
    return MARKDOWN_MAX_PAGE_SIZE
  }
  return value
}

export function normalizeTimeoutMs(requested?: number): number {
  if (typeof requested !== 'number' || Number.isNaN(requested) || requested <= 0) {
    return MARKDOWN_DEFAULT_TIMEOUT_MS
  }
  const value = Math.floor(requested)
  if (value > MARKDOWN_MAX_TIMEOUT_MS) {
    return MARKDOWN_MAX_TIMEOUT_MS
  }
  return value
}

export function normalizeContextLines(before?: number, after?: number): { before: number; after: number } {
  const clamp = (value: number | undefined, fallback: number) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      return fallback
    }
    if (value > MARKDOWN_MAX_CONTEXT_LINES) {
      return MARKDOWN_MAX_CONTEXT_LINES
    }
    return Math.floor(value)
  }

  const resolvedBefore = clamp(before, MARKDOWN_DEFAULT_CONTEXT_BEFORE)
  const resolvedAfter = clamp(after, MARKDOWN_DEFAULT_CONTEXT_AFTER)

  return {
    before: resolvedBefore,
    after: resolvedAfter,
  }
}

export function validateRegex(pattern: string, flags?: string): void {
  if (!pattern.length) {
    throw new MarkdownSearchValidationError('Regex pattern cannot be empty')
  }

  try {
    const testRegex = new RegExp(pattern, flags)
    void testRegex
  } catch (error) {
    throw new MarkdownSearchValidationError(
      error instanceof Error ? error.message : 'Invalid regular expression pattern',
    )
  }
}

export function buildGuardedSearchConfig(input: {
  maxMatches?: number
  timeoutMs?: number
  contextBefore?: number
  contextAfter?: number
  ignoreCase?: boolean
  regex?: boolean
  flags?: string
  pattern: string
}): GuardedSearchConfig {
  const regex = Boolean(input.regex)
  const ignoreCase = input.ignoreCase !== false
  const flags = regex ? normalizeRegexFlags(input.flags, ignoreCase) : undefined

  if (regex) {
    validateRegex(input.pattern, flags)
  }

  const { before, after } = normalizeContextLines(input.contextBefore, input.contextAfter)

  return {
    maxMatches: normalizeMatchLimit(input.maxMatches),
    timeoutMs: normalizeTimeoutMs(input.timeoutMs),
    contextBefore: before,
    contextAfter: after,
    ignoreCase,
    regex,
    flags,
  }
}

export function normalizeRegexFlags(flags: string | undefined, ignoreCase: boolean): string {
  const normalized = new Set<string>()
  const allowed = new Set(['i', 'm', 's', 'u', 'y'])
  if (typeof flags === 'string') {
    for (const char of flags) {
      if (allowed.has(char)) {
        normalized.add(char)
      }
    }
  }

  if (ignoreCase) normalized.add('i')
  normalized.delete('g')

  return Array.from(normalized).sort().join('')
}

export function recordTelemetry(
  client: ObservationTelemetryClient | null | undefined,
  event: Parameters<ObservationTelemetryClient['record']>[0],
): void {
  if (!client) return
  void client.record(event).catch(() => {
    // Intentionally swallow telemetry errors to avoid interrupting critical paths.
  })
}
