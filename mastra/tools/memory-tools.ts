import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type { ToolResult } from '../../lib/types/database'
import { getStorageAdapter } from '../../lib/memory/snapshots/fs-helpers'

const searchConversationsSchema = z.object({
  query: z.string().min(1).describe('The search query for keywords or themes'),
  timePeriod: z.enum(['last_7_days', 'last_30_days', 'all_time']).default('all_time').describe('The time period to search within'),
  userId: z.string().uuid().optional().describe('User ID to search for (optional in development mode)')
})

export async function searchConversations(input: z.infer<typeof searchConversationsSchema>): Promise<ToolResult<any[]>> {
  try {
    const validated = searchConversationsSchema.parse(input)
    const userId = resolveUserId(validated.userId)
    const adapter = await getStorageAdapter()
    const fileList = (await adapter.list(`users/${userId}/sessions`)).filter(f => f.endsWith('.json'))

    let sessions: any[] = []

    for (const file of fileList) {
      const text = await adapter.getText(file)
      if (!text) continue
      try {
        const parsed = JSON.parse(text)
        sessions.push(parsed)
      } catch {}
    }

    if (validated.timePeriod !== 'all_time') {
      const cutoff = new Date()
      const days = validated.timePeriod === 'last_7_days' ? 7 : 30
      cutoff.setDate(cutoff.getDate() - days)
      const cutoffMs = cutoff.getTime()
      sessions = sessions.filter(s => {
        const created = new Date(s.created_at)
        return !isNaN(created.getTime()) && created.getTime() >= cutoffMs
      })
    }

    sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const searchResults: any[] = []
    const lowerCaseQuery = validated.query.toLowerCase()

    for (const session of sessions) {
      if (Array.isArray(session.messages)) {
        for (const message of session.messages) {
          if (typeof message.content === 'string' && message.content.toLowerCase().includes(lowerCaseQuery)) {
            searchResults.push({
              ...message,
              sessionId: session.id,
              sessionCreatedAt: session.created_at
            })
          }
        }
      }
    }

    return {
      success: true,
      data: searchResults.slice(0, 20), // Limit results for now
      confidence: 1.0
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
