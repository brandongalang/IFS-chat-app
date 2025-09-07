import { createTool } from '@mastra/core';
import { z } from 'zod';
import { a as actionLogger } from '../action-logger.mjs';
import { createServerClient } from '@supabase/ssr';
import '../admin.mjs';
import '@supabase/supabase-js';
import '../canonicalize.mjs';
import 'node:crypto';

function getEnvVar(keys) {
  const anyProcessEnv = typeof process !== "undefined" ? process.env : void 0;
  if (anyProcessEnv) {
    for (const k of keys) {
      const v = anyProcessEnv[k];
      if (v) return v;
    }
  }
  return void 0;
}
function getSupabaseClient() {
  const url = getEnvVar(["NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const anonKey = getEnvVar(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (!url || !anonKey) {
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n\nMissing NEXT_PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY."
    );
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {
      }
    }
  });
}
const recordPartAssessmentSchema = z.object({
  userId: z.string().uuid().describe("User ID who owns the part"),
  partId: z.string().uuid().describe("The UUID of the part to assess"),
  score: z.number().min(0).max(1).describe("Identification confidence score (0..1) from LLM-as-judge or human"),
  rationale: z.string().min(1).max(2e3).describe("Why this score was chosen"),
  evidenceRefs: z.array(z.string()).optional().default([]).describe("Optional evidence IDs/notes"),
  source: z.enum(["agent_llm", "human"]).default("agent_llm"),
  model: z.string().optional().describe("Model identifier if source is agent_llm"),
  idempotencyKey: z.string().min(8).max(128).optional().describe("Prevents duplicate application on retries")
});
async function recordPartAssessment(input) {
  const supabase = getSupabaseClient();
  const { error: assessErr } = await supabase.from("part_assessments").insert({
    user_id: input.userId,
    part_id: input.partId,
    source: input.source,
    score: input.score,
    rationale: input.rationale,
    evidence_refs: input.evidenceRefs || [],
    model: input.model,
    idempotency_key: input.idempotencyKey
  });
  if (assessErr) {
    const msg = assessErr.message || "";
    const isIdem = msg.includes("uq_part_assessments_idem");
    if (!isIdem) {
      return { success: false, error: `Failed to record assessment: ${assessErr.message}` };
    }
  }
  const updates = { confidence: input.score, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  try {
    const updated = await actionLogger.loggedUpdate(
      "parts",
      input.partId,
      updates,
      input.userId,
      "record_part_assessment",
      {
        partName: void 0,
        changeDescription: `Set identification confidence to ${input.score}`,
        score: input.score,
        source: input.source,
        model: input.model
      }
    );
    return { success: true, data: updated, confidence: input.score };
  } catch (e) {
    return { success: false, error: e?.message || "Unknown error while updating part confidence" };
  }
}
const recordPartAssessmentTool = createTool({
  id: "recordPartAssessment",
  description: "Record an identification assessment for a part (LLM-as-judge or human) and set the part's confidence explicitly. Provide idempotencyKey to avoid duplicate application on retries.",
  inputSchema: recordPartAssessmentSchema,
  execute: async ({ context }) => {
    const result = await recordPartAssessment(context);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
});
const assessmentTools = {
  recordPartAssessment: recordPartAssessmentTool
};

export { assessmentTools, recordPartAssessment, recordPartAssessmentTool };
