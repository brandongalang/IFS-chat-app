import path from 'node:path'

import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

import type {
  MarkdownListItem,
  MarkdownListParams,
  MarkdownReadChunk,
  MarkdownReadParams,
  MarkdownSearchMatch,
  MarkdownSearchParams,
  MarkdownSearchResult,
} from './types'
import {
  buildGuardedSearchConfig,
  MARKDOWN_MIN_PAGE_SIZE,
  MarkdownSearchValidationError,
  normalizePageSize,
  recordTelemetry,
} from './guards'
import { minimatch } from 'minimatch'
import type { ObservationTelemetryClient } from './types'

const ROOT_NAMESPACE = 'users'
const UNKNOWN_TIMESTAMP = '1970-01-01T00:00:00.000Z'

function resolveUserRoot(userId: string): string {
  if (!userId) {
    throw new MarkdownSearchValidationError('userId is required')
  }
  const normalized = userId.trim()
  if (!normalized) {
    throw new MarkdownSearchValidationError('userId cannot be empty')
  }
  return path.posix.join(ROOT_NAMESPACE, normalized)
}

function sanitizeRelativePath(segment: string | undefined): string {
  if (!segment) return ''
  const normalized = path.posix.normalize(segment.replace(/^\/+/g, ''))
  if (normalized === '.' || normalized === './') return ''
  if (normalized.startsWith('..')) {
    throw new MarkdownSearchValidationError('Invalid path scope')
  }
  return normalized
}

function buildAbsolutePath(userId: string, relative: string): string {
  const root = resolveUserRoot(userId)
  const sanitized = sanitizeRelativePath(relative)
  const joined = sanitized ? path.posix.join(root, sanitized) : root
  if (!joined.startsWith(`${ROOT_NAMESPACE}/`)) {
    throw new MarkdownSearchValidationError('Resolved path escapes user scope')
  }
  return joined
}

function pathMatchesGlob(relativePath: string, pattern: string | string[] | undefined): boolean {
  if (!pattern || (Array.isArray(pattern) && pattern.length === 0)) {
    return true
  }
  if (Array.isArray(pattern)) {
    return pattern.some((entry) => minimatch(relativePath, entry))
  }
  return minimatch(relativePath, pattern)
}

function ensureMarkdownPath(pathname: string): boolean {
  return pathname.endsWith('.md')
}

export async function listMarkdownFiles(params: MarkdownListParams): Promise<MarkdownListItem[]> {
  const storage = await getStorageAdapter()
  const root = resolveUserRoot(params.userId)
  const relativePrefix = sanitizeRelativePath(params.prefix)
  const absolutePrefix = buildAbsolutePath(params.userId, relativePrefix)

  const paths = await storage.list(absolutePrefix)
  const limit = typeof params.limit === 'number' && params.limit >= 0 ? params.limit : Number.POSITIVE_INFINITY

  const items: MarkdownListItem[] = []

  for (const absolute of paths) {
    if (!absolute.startsWith(root)) continue
    const relative = path.posix.relative(root, absolute)
    if (!ensureMarkdownPath(relative)) continue
    if (!pathMatchesGlob(relative, params.glob)) continue

    const text = await storage.getText(absolute)
    const size = text ? Buffer.byteLength(text, 'utf8') : 0

    items.push({
      path: relative,
      size,
      updatedAt: UNKNOWN_TIMESTAMP,
    })

    if (items.length >= limit) break
  }

  return items
}

export async function searchMarkdown(
  params: MarkdownSearchParams,
  telemetry?: ObservationTelemetryClient | null,
): Promise<MarkdownSearchResult> {
  const storage = await getStorageAdapter()
  const root = resolveUserRoot(params.userId)
  const relativePrefix = sanitizeRelativePath(params.prefix)
  const absolutePrefix = buildAbsolutePath(params.userId, relativePrefix)
  const config = buildGuardedSearchConfig({
    pattern: params.pattern,
    maxMatches: params.maxMatches,
    timeoutMs: params.timeoutMs,
    contextBefore: params.contextBefore,
    contextAfter: params.contextAfter,
    ignoreCase: params.ignoreCase,
    regex: params.regex,
    flags: params.flags,
  })

  const paths = await storage.list(absolutePrefix)

  const matches: MarkdownSearchMatch[] = []
  const startedAt = Date.now()
  const deadline = startedAt + config.timeoutMs

  const pattern = params.pattern
  const searchNeedle = config.ignoreCase ? pattern.toLowerCase() : pattern
  const regex = config.regex ? new RegExp(pattern, config.flags) : null

  let truncated = false

  for (const absolute of paths) {
    if (Date.now() > deadline) {
      truncated = true
      break
    }

    if (!absolute.startsWith(root)) continue
    const relative = path.posix.relative(root, absolute)
    if (!ensureMarkdownPath(relative)) continue
    if (!pathMatchesGlob(relative, params.glob)) continue

    const content = await storage.getText(absolute)
    if (!content) continue

    const lines = content.split(/\r?\n/)

    for (let index = 0; index < lines.length; index += 1) {
      if (Date.now() > deadline) {
        truncated = true
        break
      }

      const line = lines[index]
      let hasMatch = false

      if (regex) {
        regex.lastIndex = 0
        hasMatch = regex.test(line)
      } else {
        const haystack = config.ignoreCase ? line.toLowerCase() : line
        hasMatch = haystack.includes(searchNeedle)
      }

      if (!hasMatch) continue

      const start = Math.max(0, index - config.contextBefore)
      const end = Math.min(lines.length, index + 1 + config.contextAfter)

      matches.push({
        path: relative,
        line: index + 1,
        snippet: line,
        before: lines.slice(start, index),
        after: lines.slice(index + 1, end),
      })

      if (matches.length >= config.maxMatches) {
        truncated = true
        break
      }
    }

    if (truncated) break
  }

  recordTelemetry(telemetry, {
    tool: 'md.search',
    userId: params.userId,
    durationMs: Math.max(0, Date.now() - startedAt),
    metadata: {
      prefix: relativePrefix,
      glob: params.glob,
      regex: config.regex,
      matchCount: matches.length,
    },
    error: truncated && Date.now() > deadline ? 'timeout' : undefined,
  })

  return {
    matches,
    truncated,
    runtimeMs: Math.max(0, Date.now() - startedAt),
  }
}

export async function readMarkdown(params: MarkdownReadParams): Promise<MarkdownReadChunk> {
  const storage = await getStorageAdapter()
  const relativePath = sanitizeRelativePath(params.path)
  const absolutePath = buildAbsolutePath(params.userId, relativePath)

  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.max(MARKDOWN_MIN_PAGE_SIZE, normalizePageSize(params.limit))

  const content = await storage.getText(absolutePath)
  if (content == null) {
    return {
      path: relativePath,
      offset,
      nextOffset: null,
      data: '',
      hasMore: false,
    }
  }

  const slice = content.slice(offset, offset + limit)
  const nextOffset = offset + slice.length < content.length ? offset + slice.length : null

  return {
    path: relativePath,
    offset,
    nextOffset,
    data: slice,
    hasMore: nextOffset !== null,
  }
}
