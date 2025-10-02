import type { ObservationTelemetryClient } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const DEFAULT_LOOKBACK_DAYS = 14
export const MIN_LOOKBACK_DAYS = 1
export const MAX_LOOKBACK_DAYS = 60

export const DEFAULT_PAGE_SIZE = 20
export const MIN_PAGE_SIZE = 5
export const MAX_PAGE_SIZE = 100

export const DEFAULT_RESULT_LIMIT = 10
export const MIN_RESULT_LIMIT = 1
export const MAX_RESULT_LIMIT = 50

export function normalizeLookbackDays(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_LOOKBACK_DAYS
  }
  const rounded = Math.floor(value)
  if (rounded < MIN_LOOKBACK_DAYS) return MIN_LOOKBACK_DAYS
  if (rounded > MAX_LOOKBACK_DAYS) return MAX_LOOKBACK_DAYS
  return rounded
}

export function normalizeResultLimit(value: number | undefined, defaults: { fallback?: number; max?: number } = {}): number {
  const fallback = defaults.fallback ?? DEFAULT_RESULT_LIMIT
  const max = defaults.max ?? MAX_RESULT_LIMIT

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }
  const rounded = Math.floor(value)
  if (rounded < MIN_RESULT_LIMIT) return MIN_RESULT_LIMIT
  if (rounded > max) return max
  return rounded
}

export function normalizePageSize(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_PAGE_SIZE
  }
  const rounded = Math.floor(value)
  if (rounded < MIN_PAGE_SIZE) return MIN_PAGE_SIZE
  if (rounded > MAX_PAGE_SIZE) return MAX_PAGE_SIZE
  return rounded
}

export function resolveSinceDate(lookbackDays: number, reference: Date = new Date()): Date {
  const since = new Date(reference.getTime() - lookbackDays * MS_PER_DAY)
  return since
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function extractSnippet(text: string | null | undefined, query: string): string | null {
  if (!text) return null

  const normalizedText = text.toLowerCase()
  const index = normalizedText.indexOf(query)
  if (index === -1) return null

  const window = 80
  const start = Math.max(0, index - window)
  const end = Math.min(text.length, index + query.length + window)
  const snippet = text.slice(start, end).trim()
  return snippet.length > 0 ? snippet : text.slice(0, Math.min(text.length, 160)).trim()
}

export function toLower(value: string | null | undefined): string {
  return (value ?? '').toLowerCase()
}

export async function safeRecordTelemetry(
  client: ObservationTelemetryClient | null | undefined,
  event: Parameters<ObservationTelemetryClient['record']>[0],
): Promise<void> {
  if (!client) return
  try {
    await client.record(event)
  } catch {
    // Ignore telemetry failures; caller paths should not throw.
  }
}
