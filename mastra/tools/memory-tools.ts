import { createTool } from '@mastra/core';
import { z } from 'zod';
import { resolveUserId } from '@/config/dev';
import type { ToolResult } from '@/lib/types/database';
import { SearchResultSchema } from '../schemas';

const searchConversationsSchema = z
  .object({
    query: z.string().min(1).describe('The search query for keywords or themes'),
    timePeriod: z
      .enum(['last_7_days', 'last_30_days', 'all_time'])
      .default('all_time')
      .describe('The time period to search within'),
  })
  .strict();

export type SearchConversationsInput = z.infer<typeof searchConversationsSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;

export async function searchConversations(
  input: SearchConversationsInput,
  userId: string
): Promise<ToolResult<SearchResult[]>> {
  try {
    // TODO: Search conversations in DB (memory v2 snapshots removed)
    const searchResults: SearchResult[] = [];

    return {
      success: true,
      data: searchResults.slice(0, 20),
      confidence: 1.0,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errMsg };
  }
}

export function createMemoryTools(userId?: string) {
  const searchConversationsTool = createTool({
    id: 'searchConversations',
    description: "Performs a semantic search over the user's entire chat history.",
    inputSchema: searchConversationsSchema,
    execute: async ({
      context,
      runtime,
    }: {
      context: SearchConversationsInput;
      runtime?: { userId?: string };
    }) => {
      const resolvedUserId = resolveUserId(runtime?.userId ?? userId);
      const result = await searchConversations(context, resolvedUserId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  return {
    searchConversations: searchConversationsTool,
  };
}

export type MemoryTools = ReturnType<typeof createMemoryTools>;
