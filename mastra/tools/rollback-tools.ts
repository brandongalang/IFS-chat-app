import { createTool } from '@mastra/core'
import { z } from 'zod'
import { actionLogger } from '../../lib/database/action-logger'
import type { ActionType } from '../../lib/database/action-logger'

// Input schemas for rollback tools
const getRecentActionsSchema = z.object({
  userId: z.string().uuid().describe('User ID to get recent actions for'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of recent actions to return'),
  actionTypes: z.array(z.enum([
    'create_emerging_part',
    'update_part_confidence', 
    'update_part_category',
    'update_part_attributes',
    'add_part_evidence',
    'acknowledge_part',
    'create_relationship',
    'update_relationship',
    'create_session',
    'update_session',
    'end_session'
  ])).optional().describe('Filter by specific action types'),
  sessionId: z.string().uuid().optional().describe('Filter by specific session'),
  withinMinutes: z.number().min(1).max(1440).default(30).describe('Only show actions within this many minutes')
})

const rollbackByDescriptionSchema = z.object({
  userId: z.string().uuid().describe('User ID whose action to rollback'),
  description: z.string().min(3).describe('Natural language description of the action to rollback (e.g., "increased Inner Critic confidence", "created Perfectionist part")'),
  reason: z.string().default('User requested rollback').describe('Reason for the rollback'),
  withinMinutes: z.number().min(1).max(1440).default(30).describe('Only look for actions within this timeframe')
})

const rollbackActionSchema = z.object({
  actionId: z.string().uuid().describe('ID of the specific action to rollback (from getRecentActions)'),
  reason: z.string().default('Agent rollback').describe('Reason for rolling back this action')
})

/**
 * Get recent agent actions for review before rollback
 */
export async function getRecentActions(input: z.infer<typeof getRecentActionsSchema>) {
  try {
    const validated = getRecentActionsSchema.parse(input)
    
    const actions = await actionLogger.getRecentActions(
      validated.userId,
      validated.limit,
      validated.actionTypes as ActionType[],
      validated.sessionId,
      validated.withinMinutes
    )

    return {
      success: true,
      data: actions,
      message: `Found ${actions.length} recent actions`
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Rollback action using natural language description
 */
export async function rollbackByDescription(input: z.infer<typeof rollbackByDescriptionSchema>) {
  try {
    const validated = rollbackByDescriptionSchema.parse(input)
    
    const result = await actionLogger.rollbackByDescription(
      validated.userId,
      validated.description,
      validated.reason,
      validated.withinMinutes
    )

    return {
      success: result.success,
      message: result.message,
      actionType: result.actionType
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Rollback specific action by ID
 */
export async function rollbackAction(input: z.infer<typeof rollbackActionSchema>) {
  try {
    const validated = rollbackActionSchema.parse(input)
    
    const result = await actionLogger.rollbackAction(
      validated.actionId,
      validated.reason
    )

    return {
      success: result.success,
      message: result.message,
      actionType: result.actionType
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// Export tool definitions for Mastra
export const getRecentActionsTool = createTool({
  id: 'getRecentActions',
  description: 'Get recent agent actions for review and potential rollback. Use this first to see what actions can be undone.',
  inputSchema: getRecentActionsSchema,
  execute: async ({ context }) => {
    const result = await getRecentActions(context)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  }
})

export const rollbackByDescriptionTool = createTool({
  id: 'rollbackByDescription',
  description: 'Rollback an agent action using natural language description. Use when user says things like "undo that confidence change" or "remove that new part".',
  inputSchema: rollbackByDescriptionSchema,
  execute: async ({ context }) => {
    const result = await rollbackByDescription(context)
    if (!result.success) {
      throw new Error(result.error)
    }
    return {
      message: result.message,
      actionType: result.actionType
    }
  }
})

export const rollbackActionTool = createTool({
  id: 'rollbackAction',
  description: 'Rollback a specific action by ID. Use after getRecentActions to rollback a specific action from the list.',
  inputSchema: rollbackActionSchema,
  execute: async ({ context }) => {
    const result = await rollbackAction(context)
    if (!result.success) {
      throw new Error(result.error)
    }
    return {
      message: result.message,
      actionType: result.actionType
    }
  }
})

export const rollbackTools = {
  getRecentActions: getRecentActionsTool,
  rollbackByDescription: rollbackByDescriptionTool,
  rollbackAction: rollbackActionTool
}