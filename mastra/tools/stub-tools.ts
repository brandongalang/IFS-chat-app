import 'server-only'

import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type { ToolResult, PartRow } from '../../lib/types/database'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

const createPartStubSchema = z.object({
  name: z.string().min(1).max(100).describe('Name of the emerging part stub'),
  evidenceContent: z.string().min(1).describe('Evidence content'),
  sessionId: z.string().uuid().describe('Session where evidence was observed'),
  userId: z.string().uuid().optional().describe('User ID (optional in development)'),
})

export async function createPartStub(input: z.infer<typeof createPartStubSchema>): Promise<ToolResult<PartRow>> {
  try {
    const validated = createPartStubSchema.parse(input)
    resolveUserId(validated.userId)
    await getStorageAdapter()
    return { success: true, data: { id: '', name: validated.name } as PartRow, confidence: 0.1 }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

export const createPartStubTool = createTool({
  id: 'createPartStub',
  description: "Creates a lightweight 'stub' of a new part.",
  inputSchema: createPartStubSchema,
  execute: async ({ context }) => {
    const result = await createPartStub(context)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
})

export const stubTools = {
  createPartStub: createPartStubTool,
}

