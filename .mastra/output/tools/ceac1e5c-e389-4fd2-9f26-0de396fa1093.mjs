import { createTool } from '@mastra/core';
import { z } from 'zod';
import { r as resolveUserId } from '../dev.mjs';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required.");
  }
  return createClient(url, anonKey);
}
const searchConversationsSchema = z.object({
  query: z.string().min(1).describe("The search query for keywords or themes"),
  timePeriod: z.enum(["last_7_days", "last_30_days", "all_time"]).default("all_time").describe("The time period to search within"),
  userId: z.string().uuid().optional().describe("User ID to search for (optional in development mode)")
});
async function searchConversations(input) {
  try {
    const validated = searchConversationsSchema.parse(input);
    const userId = resolveUserId(validated.userId);
    const supabase = getSupabaseClient();
    let queryBuilder = supabase.from("sessions").select("id, messages, created_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (validated.timePeriod !== "all_time") {
      const date = /* @__PURE__ */ new Date();
      const days = validated.timePeriod === "last_7_days" ? 7 : 30;
      date.setDate(date.getDate() - days);
      queryBuilder = queryBuilder.gte("created_at", date.toISOString());
    }
    const { data: sessions, error } = await queryBuilder;
    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }
    if (!sessions) {
      return { success: true, data: [], confidence: 1 };
    }
    const searchResults = [];
    const lowerCaseQuery = validated.query.toLowerCase();
    for (const session of sessions) {
      if (Array.isArray(session.messages)) {
        for (const message of session.messages) {
          if (typeof message.content === "string" && message.content.toLowerCase().includes(lowerCaseQuery)) {
            searchResults.push({
              ...message,
              sessionId: session.id,
              sessionCreatedAt: session.created_at
            });
          }
        }
      }
    }
    return {
      success: true,
      data: searchResults.slice(0, 20),
      // Limit results for now
      confidence: 1
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: errMsg };
  }
}
const searchConversationsTool = createTool({
  id: "searchConversations",
  description: "Performs a semantic search over the user's entire chat history.",
  inputSchema: searchConversationsSchema,
  execute: async ({ context }) => {
    const result = await searchConversations(context);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }
});
const memoryTools = {
  searchConversations: searchConversationsTool
};

export { memoryTools, searchConversations, searchConversationsTool };
