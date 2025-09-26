import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type { ToolResult, PartRow } from '@/lib/types/database'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

const createPartStubSchema = z
  .object({
    name: z.string().min(1).max(100).describe('Name of the emerging part stub'),
    evidenceContent: z.string().min(1).describe('Evidence content'),
    sessionId: z.string().uuid().describe('Session where evidence was observed'),
  })
  .strict()

export type CreatePartStubInput = z.infer<typeof createPartStubSchema>

export async function createPartStub(
  input: CreatePartStubInput,
  userId: string
): Promise<ToolResult<PartRow>> {
  try {
    createPartStubSchema.parse(input)
    resolveUserId(userId)
    await getStorageAdapter()
    return { success: true, data: { id: '', name: input.name } as PartRow, confidence: 0.1 }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

export function createStubTools(userId?: string) {
  const createPartStubTool = createTool({
    id: 'createPartStub',
    description: "Creates a lightweight 'stub' of a new part.",
    inputSchema: createPartStubSchema,
    execute: async ({ context, runtime }: { context: CreatePartStubInput; runtime?: { userId?: string } }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? userId)
      const result = await createPartStub(context, resolvedUserId)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })

  return {
    createPartStub: createPartStubTool,
  }
}

export type StubTools = ReturnType<typeof createStubTools>
