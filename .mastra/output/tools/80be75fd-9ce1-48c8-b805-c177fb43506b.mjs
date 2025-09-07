import { createTool } from '@mastra/core';
import { z } from 'zod';
import { a as actionLogger } from '../action-logger.mjs';
import { r as resolveUserId } from '../dev.mjs';
import { createClient } from '@supabase/supabase-js';
import '@supabase/ssr';
import 'node:crypto';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required.");
  }
  return createClient(url, anonKey);
}
const createPartStubSchema = z.object({
  name: z.string().min(1).max(100).describe("Name of the emerging part stub"),
  evidenceContent: z.string().min(1).describe("The single piece of evidence content for creating the stub"),
  sessionId: z.string().uuid().describe("The session ID where the evidence was observed"),
  userId: z.string().uuid().optional().describe("User ID who owns the part (optional in development mode)")
});
async function createPartStub(input) {
  try {
    const validated = createPartStubSchema.parse(input);
    const userId = resolveUserId();
    const supabase = getSupabaseClient();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: existingPart } = await supabase.from("parts").select("id, name").eq("user_id", userId).ilike("name", validated.name).single();
    if (existingPart) {
      return {
        success: false,
        error: `A part named "${validated.name}" already exists for this user. Use logEvidence instead.`
      };
    }
    const evidence = {
      type: "direct_mention",
      content: validated.evidenceContent,
      confidence: 0.5,
      // Default confidence for a single piece of evidence
      sessionId: validated.sessionId,
      timestamp: now
    };
    const partInsert = {
      user_id: userId,
      name: validated.name,
      status: "emerging",
      category: "unknown",
      confidence: 0.1,
      // Very low confidence for a stub
      evidence_count: 1,
      recent_evidence: [evidence],
      story: {
        origin: null,
        currentState: `Part stub created from initial evidence: "${validated.evidenceContent}"`,
        purpose: null,
        evolution: [{
          timestamp: now,
          change: "Part stub created",
          trigger: "Agent action via createPartStub"
        }]
      },
      visualization: {
        emoji: "\u{1F331}",
        color: "#A0A0A0",
        energyLevel: 0.3
      }
    };
    const data = await actionLogger.loggedInsert(
      "parts",
      partInsert,
      userId,
      "create_emerging_part",
      // Using existing action type for consistency
      {
        partName: validated.name,
        changeDescription: `Created part stub for "${validated.name}"`,
        sessionId: validated.sessionId,
        evidenceCount: 1,
        category: "unknown",
        confidence: 0.1
      }
    );
    return {
      success: true,
      data,
      confidence: 0.1
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, error: errMsg };
  }
}
const createPartStubTool = createTool({
  id: "createPartStub",
  description: "Creates a lightweight 'stub' of a new part with minimal information and a low confidence score. Use this when a part is mentioned for the first time to get a partId for future operations.",
  inputSchema: createPartStubSchema,
  execute: async ({ context }) => {
    const result = await createPartStub(context);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }
});
const stubTools = {
  createPartStub: createPartStubTool
};

export { createPartStub, createPartStubTool, stubTools };
