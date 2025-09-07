import { createTool } from '@mastra/core';
import { z } from 'zod';
import { a as actionLogger } from '../action-logger.mjs';
import '../admin.mjs';
import '@supabase/ssr';
import '@supabase/supabase-js';
import '../canonicalize.mjs';
import 'node:crypto';

const getRecentActionsSchema = z.object({
  userId: z.string().uuid().describe("User ID to get recent actions for"),
  limit: z.number().min(1).max(50).default(10).describe("Maximum number of recent actions to return"),
  actionTypes: z.array(z.enum([
    "create_emerging_part",
    "update_part_confidence",
    "update_part_category",
    "update_part_attributes",
    "add_part_evidence",
    "acknowledge_part",
    "create_relationship",
    "update_relationship",
    "create_session",
    "update_session",
    "end_session"
  ])).optional().describe("Filter by specific action types"),
  sessionId: z.string().uuid().optional().describe("Filter by specific session"),
  withinMinutes: z.number().min(1).max(1440).default(30).describe("Only show actions within this many minutes")
});
const rollbackByDescriptionSchema = z.object({
  userId: z.string().uuid().describe("User ID whose action to rollback"),
  description: z.string().min(3).describe('Natural language description of the action to rollback (e.g., "increased Inner Critic confidence", "created Perfectionist part")'),
  reason: z.string().default("User requested rollback").describe("Reason for the rollback"),
  withinMinutes: z.number().min(1).max(1440).default(30).describe("Only look for actions within this timeframe")
});
const rollbackActionSchema = z.object({
  actionId: z.string().uuid().describe("ID of the specific action to rollback (from getRecentActions)"),
  reason: z.string().default("Agent rollback").describe("Reason for rolling back this action")
});
async function getRecentActions(input) {
  try {
    const validated = getRecentActionsSchema.parse(input);
    const actions = await actionLogger.getRecentActions(
      validated.userId,
      validated.limit,
      validated.actionTypes,
      validated.sessionId,
      validated.withinMinutes
    );
    return {
      success: true,
      data: actions,
      message: `Found ${actions.length} recent actions`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
async function rollbackByDescription(input) {
  try {
    const validated = rollbackByDescriptionSchema.parse(input);
    const result = await actionLogger.rollbackByDescription(
      validated.userId,
      validated.description,
      validated.reason,
      validated.withinMinutes
    );
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
async function rollbackAction(input) {
  try {
    const validated = rollbackActionSchema.parse(input);
    const result = await actionLogger.rollbackAction(
      validated.actionId,
      validated.reason
    );
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
const getRecentActionsTool = createTool({
  id: "getRecentActions",
  description: "Get recent agent actions for review and potential rollback. Use this first to see what actions can be undone.",
  inputSchema: getRecentActionsSchema,
  execute: async ({ context }) => {
    const result = await getRecentActions(context);
    if (!result.success) {
      throw new Error(result.error || result.message || "Unknown error");
    }
    return result.data;
  }
});
const rollbackByDescriptionTool = createTool({
  id: "rollbackByDescription",
  description: 'Rollback an agent action using natural language description. Use when user says things like "undo that confidence change" or "remove that new part".',
  inputSchema: rollbackByDescriptionSchema,
  execute: async ({ context }) => {
    const result = await rollbackByDescription(context);
    if (!result.success) {
      throw new Error(result.error || result.message || "Unknown error");
    }
    return result;
  }
});
const rollbackActionTool = createTool({
  id: "rollbackAction",
  description: "Rollback a specific action by ID. Use after getRecentActions to rollback a specific action from the list.",
  inputSchema: rollbackActionSchema,
  execute: async ({ context }) => {
    const result = await rollbackAction(context);
    if (!result.success) {
      throw new Error(result.error || result.message || "Unknown error");
    }
    return result;
  }
});
const rollbackTools = {
  getRecentActions: getRecentActionsTool,
  rollbackByDescription: rollbackByDescriptionTool,
  rollbackAction: rollbackActionTool
};

export { getRecentActions, getRecentActionsTool, rollbackAction, rollbackActionTool, rollbackByDescription, rollbackByDescriptionTool, rollbackTools };
