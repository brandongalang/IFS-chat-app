import 'server-only'

import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type { ToolResult } from '@/lib/types/database'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

const searchConversationsSchema = z.object({
  query: z.string().min(1).describe('The search query for keywords or themes'),
  timePeriod: z.enum(['last_7_days', 'last_30_days', 'all_time']).default('all_time').describe('The time period to search within'),
  userId: z.string().uuid().optional().describe('User ID to search for (optional in development mode)')
})

export async function searchConversations(input: z.infer<typeof searchConversationsSchema>): Promise<ToolResult<any[]>> {
  try {
    const validated = searchConversationsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const storage = await getStorageAdapter()

    // List session files for the user and attempt a simple text search.
    const prefix = `users/${userId}/sessions`
    const paths = await storage.list(prefix)
    const searchResults: any[] = []
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
            searchResults.push({
              ...message,
              sessionId: session.id,
              sessionCreatedAt: session.created_at,
            })
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

export const searchConversationsTool = createTool({
  id: 'searchConversations',
  description: "Performs a semantic search over the user's entire chat history.",
  inputSchema: searchConversationsSchema,
  execute: async ({ context }) => {
    const result = await searchConversations(context)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  }
})

export const memoryTools = {
    searchConversations: searchConversationsTool
}