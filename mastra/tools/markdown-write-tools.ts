import path from 'node:path'

import { createTool } from '@mastra/core'
import { z } from 'zod'

import { resolveUserId } from '@/config/dev'
import { lintMarkdown, listSections, patchSectionByAnchor } from '@/lib/memory/markdown/md'
import { buildUserOverviewMarkdown } from '@/lib/memory/snapshots/grammar'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

type ToolRuntime = { userId?: string }

const ROOT_NAMESPACE = 'users'
const MAX_WRITE_BYTES = 1_000_000

const writeModeSchema = z.enum(['replace', 'append'])

const previewSchema = z
  .object({
    path: z.string().min(1).max(512),
    anchor: z.string().min(1).max(200),
    mode: writeModeSchema.default('append'),
    text: z.string().min(1),
  })
  .strict()

const writeSchema = z
  .object({
    path: z.string().min(1).max(512),
    anchor: z.string().min(1).max(200),
    mode: writeModeSchema.default('append'),
    text: z.string().min(1),
    expectedBeforeHash: z.string().optional(),
  })
  .strict()

const createSchema = z
  .object({
    path: z.string().min(1).max(512),
    template: z.enum(['overview', 'blank']).default('blank'),
    initialText: z.string().optional(),
  })
  .strict()

function resolveUserRoot(userId: string): string {
  const trimmed = userId.trim()
  if (!trimmed) {
    throw new Error('User ID is required')
  }
  return path.posix.join(ROOT_NAMESPACE, trimmed)
}

function sanitizeRelativePath(segment: string): string {
  const normalized = path.posix.normalize(segment.replace(/^\/+/g, ''))
  if (normalized === '.' || normalized === './') {
    return ''
  }
  if (normalized.startsWith('..')) {
    throw new Error('Invalid path scope')
  }
  return normalized
}

function ensureMarkdownPath(relative: string): string {
  if (!relative || !relative.endsWith('.md')) {
    throw new Error('Path must target a markdown file')
  }
  return relative
}

function buildAbsolutePath(userId: string, relativePath: string): { root: string; relative: string; absolute: string } {
  const root = resolveUserRoot(userId)
  const sanitized = ensureMarkdownPath(sanitizeRelativePath(relativePath))
  const absolute = path.posix.join(root, sanitized)
  if (!absolute.startsWith(`${ROOT_NAMESPACE}/`)) {
    throw new Error('Resolved path escapes user scope')
  }
  return { root, relative: sanitized, absolute }
}

async function readFileBytes(absolute: string): Promise<Buffer> {
  const storage = await getStorageAdapter()
  const text = await storage.getText(absolute)
  if (text == null) {
    throw new Error('Markdown file not found')
  }
  return Buffer.from(text, 'utf8')
}

function bytesOf(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}

function validateWriteSize(input: string): void {
  if (bytesOf(input) > MAX_WRITE_BYTES) {
    throw new Error('Markdown payload exceeds size limits')
  }
}

async function loadSectionHeading(absolute: string, anchor: string) {
  const storage = await getStorageAdapter()
  const text = await storage.getText(absolute)
  if (text == null) {
    throw new Error('Markdown file not found')
  }
  const section = listSections(text).find((entry) => entry.anchor === anchor)
  if (!section) {
    throw new Error(`Section with anchor '${anchor}' not found`)
  }
  return { text, section }
}

async function previewSectionPatch(userId: string, input: z.infer<typeof previewSchema>) {
  const { absolute } = buildAbsolutePath(userId, input.path)
  const { text, section } = await loadSectionHeading(absolute, input.anchor)
  validateWriteSize(input.text)

  const next =
    input.mode === 'replace'
      ? patchSectionByAnchor(text, input.anchor, { replace: input.text })
      : patchSectionByAnchor(text, input.anchor, { append: `\n${input.text}` })

  const lint = lintMarkdown(next.text)
  const delta = bytesOf(next.text) - bytesOf(text)

  return {
    success: true as const,
    beforeHash: next.beforeHash,
    afterHash: next.afterHash,
    preview: next.text,
    section: { anchor: section.anchor, heading: section.heading },
    bytesDelta: delta,
    warnings: lint.warnings,
  }
}

async function writeSectionPatch(userId: string, input: z.infer<typeof writeSchema>) {
  const storage = await getStorageAdapter()
  const { absolute } = buildAbsolutePath(userId, input.path)
  const { text } = await loadSectionHeading(absolute, input.anchor)
  validateWriteSize(input.text)

  const change =
    input.mode === 'replace'
      ? patchSectionByAnchor(text, input.anchor, { replace: input.text })
      : patchSectionByAnchor(text, input.anchor, { append: `\n${input.text}` })

  if (input.expectedBeforeHash && input.expectedBeforeHash !== change.beforeHash) {
    return {
      success: false as const,
      conflict: true as const,
      currentHash: change.beforeHash,
    }
  }

  validateWriteSize(change.text)
  await storage.putText(absolute, change.text, {
    contentType: 'text/markdown; charset=utf-8',
  })
  const lint = lintMarkdown(change.text)

  return {
    success: true as const,
    beforeHash: change.beforeHash,
    afterHash: change.afterHash,
    bytesWritten: bytesOf(change.text),
    warnings: lint.warnings,
  }
}

async function createMarkdown(userId: string, input: z.infer<typeof createSchema>) {
  const storage = await getStorageAdapter()
  const { absolute, relative } = buildAbsolutePath(userId, input.path)
  const existing = await storage.getText(absolute)
  if (existing != null) {
    throw new Error('Markdown file already exists')
  }

  let content: string
  if (input.template === 'overview') {
    content = buildUserOverviewMarkdown(userId)
  } else if (typeof input.initialText === 'string') {
    validateWriteSize(input.initialText)
    content = input.initialText
  } else {
    content = '# Untitled\n\n'
  }

  validateWriteSize(content)
  await storage.putText(absolute, content, {
    contentType: 'text/markdown; charset=utf-8',
  })

  return {
    success: true as const,
    path: relative,
  }
}

function resolveToolUserId(baseUserId: string | null | undefined, runtime?: ToolRuntime): string {
  const candidate = runtime?.userId ?? baseUserId ?? undefined
  return resolveUserId(candidate)
}

export function createMarkdownWriteTools(baseUserId: string | null | undefined) {
  const previewTool = createTool({
    id: 'previewMarkdownSectionPatch',
    description: 'Preview a change to a markdown section by anchor without writing it back.',
    inputSchema: previewSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof previewSchema>; runtime?: ToolRuntime }) => {
      const input = previewSchema.parse(context)
      const resolvedUser = resolveToolUserId(baseUserId, runtime)
      return previewSectionPatch(resolvedUser, input)
    },
  })

  const writeTool = createTool({
    id: 'writeMarkdownSection',
    description: 'Apply a change to a markdown section identified by anchor with optional concurrency guard.',
    inputSchema: writeSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof writeSchema>; runtime?: ToolRuntime }) => {
      const input = writeSchema.parse(context)
      const resolvedUser = resolveToolUserId(baseUserId, runtime)
      return writeSectionPatch(resolvedUser, input)
    },
  })

  const createToolEntry = createTool({
    id: 'createMarkdownFile',
    description: 'Create a new markdown file within the user memory namespace.',
    inputSchema: createSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof createSchema>; runtime?: ToolRuntime }) => {
      const input = createSchema.parse(context)
      const resolvedUser = resolveToolUserId(baseUserId, runtime)
      return createMarkdown(resolvedUser, input)
    },
  })

  return {
    previewMarkdownSectionPatch: previewTool,
    writeMarkdownSection: writeTool,
    createMarkdownFile: createToolEntry,
  }
}

export type MarkdownWriteTools = ReturnType<typeof createMarkdownWriteTools>
