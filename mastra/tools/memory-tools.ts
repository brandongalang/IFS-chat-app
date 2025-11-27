import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type { ToolResult } from '@/lib/types/database'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { SearchResultSchema } from '../schemas'

const searchConversationsSchema = z
  .object({
    query: z.string().min(1).describe('The search query for keywords or themes'),
    timePeriod: z
      .enum(['last_7_days', 'last_30_days', 'all_time'])
      .default('all_time')
      .describe('The time period to search within'),
  })
  .strict()

export type SearchConversationsInput = z.infer<typeof searchConversationsSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>

export async function searchConversations(
  input: SearchConversationsInput,
  userId: string
): Promise<ToolResult<SearchResult[]>> {
  try {
    const validated = searchConversationsSchema.parse(input)
    const storage = await getStorageAdapter()

    const prefix = `users/${userId}/sessions`
    const paths = await storage.list(prefix)
    const searchResults: SearchResult[] = []
    const lowerCaseQuery = validated.query.toLowerCase()
    const now = new Date()

    for (const path of paths) {
      const text = await storage.getText(path)
      if (!text) continue
      try {
        const session = JSON.parse(text) as { id: string; messages: any[]; created_at: string }
        if (validated.timePeriod !== 'all_time') {
          const days = validated.timePeriod === 'last_7_days' ? 7 : 30
          const cutoff = new Date(now)
          cutoff.setDate(cutoff.getDate() - days)
          if (new Date(session.created_at) < cutoff) continue
        }
        for (const message of session.messages || []) {
          if (typeof message.content === 'string' && message.content.toLowerCase().includes(lowerCaseQuery)) {
            searchResults.push(SearchResultSchema.parse({
              ...message,
              sessionId: session.id,
              sessionCreatedAt: session.created_at,
            }))
          }
        }
      } catch {}
    }

    return {
      success: true,
      data: searchResults.slice(0, 20),
      confidence: 1.0,
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errMsg }
  }
}

export function createMemoryTools(userId?: string) {
  const searchConversationsTool = createTool({
    id: 'searchConversations',
    description: "Performs a semantic search over the user's entire chat history.",
    inputSchema: searchConversationsSchema,
    execute: async ({ context, runtime }: { context: SearchConversationsInput; runtime?: { userId?: string } }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? userId)
      const result = await searchConversations(context, resolvedUserId)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
  })

  return {
    searchConversations: searchConversationsTool,
  }
}

export type MemoryTools = ReturnType<typeof createMemoryTools>
