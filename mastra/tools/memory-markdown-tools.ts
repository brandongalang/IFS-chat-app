import { createTool } from '@mastra/core'
import { z } from 'zod'

import { resolveUserId } from '@/config/dev'
import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold'
import { readOverviewSections } from '@/lib/memory/read'

const CHANGE_LOG_ANCHOR = 'change_log v1'

const readOverviewSchema = z
  .object({
    changeLogLimit: z.number().int().min(1).max(25).default(5),
  })
  .strict()

type ToolRuntime = { userId?: string }

export function createMemoryMarkdownTools(defaultUserId?: string | null) {
  const readOverviewTool = createTool({
    id: 'readOverviewSnapshot',
    description: 'Reads the user overview snapshot and returns structured sections with recent change-log entries.',
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

  return {
    readOverviewSnapshot: readOverviewTool,
  }
}

export type MemoryMarkdownTools = ReturnType<typeof createMemoryMarkdownTools>
