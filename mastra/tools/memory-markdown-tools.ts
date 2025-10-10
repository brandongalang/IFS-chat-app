import { createTool } from '@mastra/core'
import { z } from 'zod'

import { resolveUserId } from '@/config/dev'
import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold'
import { readOverviewSections, readPartProfileSections } from '@/lib/memory/read'
import { userOverviewPath, partProfilePath, getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { appendChangeLogWithEvent, ensurePartProfileExists, onPartCreated } from '@/lib/memory/snapshots/updater'
import { editMarkdownSection } from '@/lib/memory/markdown/editor'
import { logMarkdownMutation } from '@/lib/memory/markdown/logging'

const CHANGE_LOG_ANCHOR = 'change_log v1'
const ROLE_ANCHOR = 'role v1'

const readOverviewSchema = z
  .object({
    changeLogLimit: z.number().int().min(1).max(25).default(5),
  })
  .strict()

const appendChangeLogSchema = z
  .object({
    digest: z.string().min(3).max(400),
    source: z.string().min(1).max(80).default('memory-update'),
    fingerprint: z.string().min(3).max(120).optional(),
  })
  .strict()

const upsertPartNoteSchema = z
  .object({
    partId: z.string().uuid(),
    name: z.string().min(1).max(120),
    summary: z.string().min(3).max(400),
    evidence: z.array(z.string().min(1)).max(5).optional(),
    status: z.string().min(1).max(80).optional(),
    category: z.string().min(1).max(80).optional(),
    fingerprint: z.string().min(3).max(120).optional(),
  })
  .strict()

const overviewSectionSchema = z
  .object({
    section: z.enum(['identity', 'current_focus', 'confirmed_parts']),
    lines: z.array(z.string().min(1)).min(1),
    mode: z.enum(['replace', 'append']).default('append'),
    fingerprint: z.string().min(3).max(120).optional(),
  })
  .strict()

const createPartProfileSchema = z
  .object({
    partId: z.string().uuid(),
    name: z.string().min(1).max(120),
    status: z.string().min(1).max(80).default('unknown'),
    category: z.string().min(1).max(80).default('unspecified'),
  })
  .strict()

type ToolRuntime = { userId?: string }

function formatFingerprintTag(fingerprint?: string): string {
  return fingerprint ? ` [fp:${fingerprint}]` : ''
}

function includesFingerprint(text: string | undefined, fingerprint: string | undefined): boolean {
  if (!text || !fingerprint) return false
  const pattern = new RegExp(`\\[fp:${escapeRegExp(fingerprint)}\\](?:\\s|$)`) // matches embedded fingerprint tag
  return pattern.test(text)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toBulletList(lines: string[], fingerprint?: string) {
  return lines.map((line, index) => {
    const trimmed = line.trim()
    const suffix = fingerprint && index === lines.length - 1 ? formatFingerprintTag(fingerprint) : ''
    return trimmed.startsWith('-') ? `${trimmed}${suffix}` : `- ${trimmed}${suffix}`
  })
}

export function createMemoryMarkdownTools(defaultUserId?: string | null) {
  const readOverviewTool = createTool({
    id: 'readOverviewSnapshot',
    description: 'Reads the user overview markdown and returns the key sections with recent change log entries.',
    inputSchema: readOverviewSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof readOverviewSchema>; runtime?: ToolRuntime }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? defaultUserId ?? undefined)
      await ensureOverviewExists(resolvedUserId)

      const sections = await readOverviewSections(resolvedUserId)
      if (!sections) {
        return { success: false as const, reason: 'overview_missing' as const }
      }

      const changeLogRaw = sections[CHANGE_LOG_ANCHOR]?.text ?? ''
      const changeEntries = changeLogRaw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('- '))
        .map((line) => line.slice(2))
        .slice(-context.changeLogLimit)

      const { [CHANGE_LOG_ANCHOR]: _omit, ...otherSections } = sections

      return {
        success: true as const,
        sections: otherSections,
        changeLog: changeEntries,
      }
    },
  })

  const appendChangeLogTool = createTool({
    id: 'appendOverviewChangeLog',
    description: 'Appends a concise digest entry to the user overview change log with optional fingerprint dedupe.',
    inputSchema: appendChangeLogSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof appendChangeLogSchema>; runtime?: ToolRuntime }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? defaultUserId ?? undefined)
      await ensureOverviewExists(resolvedUserId)

      const overviewPath = userOverviewPath(resolvedUserId)
      const sections = await readOverviewSections(resolvedUserId)
      const existingLog = sections?.[CHANGE_LOG_ANCHOR]?.text ?? ''

      if (includesFingerprint(existingLog, context.fingerprint)) {
        return { appended: false as const, reason: 'duplicate' as const }
      }

      const line = `${context.source}: ${context.digest}${formatFingerprintTag(context.fingerprint)}`
      await appendChangeLogWithEvent({
        userId: resolvedUserId,
        entityType: 'user',
        entityId: resolvedUserId,
        filePath: overviewPath,
        line,
      })

      return { appended: true as const }
    },
  })

  const upsertPartNoteTool = createTool({
    id: 'upsertPartNote',
    description: 'Ensures a part profile exists and appends a summary entry with optional fingerprint dedupe.',
    inputSchema: upsertPartNoteSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof upsertPartNoteSchema>; runtime?: ToolRuntime }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? defaultUserId ?? undefined)
      const profilePath = await ensurePartProfileExists({
        userId: resolvedUserId,
        partId: context.partId,
        name: context.name,
        status: context.status ?? 'unknown',
        category: context.category ?? 'unspecified',
      })

      const sections = await readPartProfileSections(resolvedUserId, context.partId)
      const changeLog = sections?.[CHANGE_LOG_ANCHOR]?.text ?? ''
      if (includesFingerprint(changeLog, context.fingerprint)) {
        return { updated: false as const, reason: 'duplicate' as const }
      }

      const summaryLine = `${context.summary}${formatFingerprintTag(context.fingerprint)}`
      await appendChangeLogWithEvent({
        userId: resolvedUserId,
        entityType: 'part',
        entityId: context.partId,
        filePath: profilePath,
        line: summaryLine,
      })

      const roleSection = sections?.[ROLE_ANCHOR]?.text ?? ''
      if (!includesFingerprint(roleSection, context.fingerprint)) {
        const bullets = toBulletList([context.summary], context.fingerprint).join('\n')
        const nextRole = roleSection ? `${roleSection}\n${bullets}` : bullets
        const result = await editMarkdownSection(profilePath, ROLE_ANCHOR, { replace: `${nextRole}\n` })
        
        // Log the mutation (non-fatal)
        await logMarkdownMutation({
          userId: resolvedUserId,
          filePath: profilePath,
          anchor: ROLE_ANCHOR,
          mode: 'replace',
          text: `${nextRole}\n`,
          beforeHash: result.beforeHash,
          afterHash: result.afterHash,
          warnings: result.lint.warnings,
        })
      }

      if (context.evidence && context.evidence.length > 0) {
        const evidenceSection = sections?.['evidence v1']?.text ?? ''
        const combined = evidenceSection ? `${evidenceSection}\n${context.evidence.map((item) => `- ${item}`).join('\n')}` : context.evidence.map((item) => `- ${item}`).join('\n')
        const result = await editMarkdownSection(profilePath, 'evidence v1', { replace: `${combined}\n` })
        
        // Log the mutation (non-fatal)
        await logMarkdownMutation({
          userId: resolvedUserId,
          filePath: profilePath,
          anchor: 'evidence v1',
          mode: 'replace',
          text: `${combined}\n`,
          beforeHash: result.beforeHash,
          afterHash: result.afterHash,
          warnings: result.lint.warnings,
        })
      }

      return { updated: true as const }
    },
  })

  const writeOverviewSectionTool = createTool({
    id: 'writeOverviewSection',
    description: 'Writes or appends bullet entries to key overview sections with optional dedupe fingerprint.',
    inputSchema: overviewSectionSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof overviewSectionSchema>; runtime?: ToolRuntime }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? defaultUserId ?? undefined)
      await ensureOverviewExists(resolvedUserId)

      const anchorMap: Record<typeof context.section, string> = {
        identity: 'identity v1',
        current_focus: 'current_focus v1',
        confirmed_parts: 'confirmed_parts v1',
      }

      const anchor = anchorMap[context.section]
      const overviewPath = userOverviewPath(resolvedUserId)
      const sections = await readOverviewSections(resolvedUserId)
      const existing = sections?.[anchor]?.text ?? ''

      if (includesFingerprint(existing, context.fingerprint)) {
        return { updated: false as const, reason: 'duplicate' as const }
      }

      const existingLines = existing
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      const normalizedNew = toBulletList(context.lines, context.fingerprint)
      const nextLines = context.mode === 'replace' ? normalizedNew : existingLines.concat(normalizedNew)
      const deduped = Array.from(new Set(nextLines))

      const result = await editMarkdownSection(overviewPath, anchor, { replace: `${deduped.join('\n')}\n` })
      
      // Log the mutation (non-fatal)
      await logMarkdownMutation({
        userId: resolvedUserId,
        filePath: overviewPath,
        anchor,
        mode: 'replace',
        text: `${deduped.join('\n')}\n`,
        beforeHash: result.beforeHash,
        afterHash: result.afterHash,
        warnings: result.lint.warnings,
      })
      
      return { updated: true as const }
    },
  })

  const createPartProfileTool = createTool({
    id: 'createPartProfileMarkdown',
    description: 'Creates a new part profile markdown file (idempotent); triggers change-log entry on first creation.',
    inputSchema: createPartProfileSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof createPartProfileSchema>; runtime?: ToolRuntime }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? defaultUserId ?? undefined)
      const storage = await getStorageAdapter()
      
      // Check if file already exists before calling ensurePartProfileExists
      const profilePath = partProfilePath(resolvedUserId, context.partId)
      const existedBefore = await storage.exists(profilePath)
      
      // Ensure the profile exists (creates if needed)
      await ensurePartProfileExists({
        userId: resolvedUserId,
        partId: context.partId,
        name: context.name,
        status: context.status,
        category: context.category,
      })
      
      // If newly created, trigger the onPartCreated event
      if (!existedBefore) {
        await onPartCreated({
          userId: resolvedUserId,
          partId: context.partId,
          name: context.name,
          status: context.status,
          category: context.category,
        })
      }
      
      return {
        created: !existedBefore,
        path: profilePath,
      }
    },
  })

  return {
    readOverviewSnapshot: readOverviewTool,
    appendOverviewChangeLog: appendChangeLogTool,
    upsertPartNote: upsertPartNoteTool,
    writeOverviewSection: writeOverviewSectionTool,
    createPartProfileMarkdown: createPartProfileTool,
  }
}

export type MemoryMarkdownTools = ReturnType<typeof createMemoryMarkdownTools>
