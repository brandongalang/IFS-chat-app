import { createTool } from '@mastra/core'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseActionLogger } from '../../lib/database/action-logger'
import type { Database } from '../../lib/types/database'

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
export async function getRecentActions(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof getRecentActionsSchema>,
) {
  try {
    const validated = getRecentActionsSchema.parse(input)

    const logger = new DatabaseActionLogger(supabase)
    const actions = await logger.getActionEvents(
      validated.userId,
      validated.limit,
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
export async function rollbackByDescription(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof rollbackByDescriptionSchema>,
) {
  try {
    const validated = rollbackByDescriptionSchema.parse(input)

    const logger = new DatabaseActionLogger(supabase)
    const result = await logger.rollbackByDescription(
      validated.userId,
      validated.description,
      validated.reason,
      validated.withinMinutes
    )

    return result
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
export async function rollbackAction(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof rollbackActionSchema>,
) {
  try {
    const validated = rollbackActionSchema.parse(input)

    const logger = new DatabaseActionLogger(supabase)
    const result = await logger.rollbackAction(
      validated.actionId,
      validated.reason
    )

    return result
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
    const { supabase, ...input } = context as z.infer<typeof getRecentActionsSchema> & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to rollback tool context')
    }

    const result = await getRecentActions(supabase, input)
    if (!result.success) {
      throw new Error((result as any).error || (result as any).message || 'Unknown error')
    }
    return result.data
  }
})

export const rollbackByDescriptionTool = createTool({
  id: 'rollbackByDescription',
  description: 'Rollback an agent action using natural language description. Use when user says things like "undo that confidence change" or "remove that new part".',
  inputSchema: rollbackByDescriptionSchema,
  execute: async ({ context }) => {
    const { supabase, ...input } = context as z.infer<typeof rollbackByDescriptionSchema> & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to rollback tool context')
    }

    const result = await rollbackByDescription(supabase, input)
    if (!result.success) {
      throw new Error((result as any).error || (result as any).message || 'Unknown error')
    }
    return result
  }
})

export const rollbackActionTool = createTool({
  id: 'rollbackAction',
  description: 'Rollback a specific action by ID. Use after getRecentActions to rollback a specific action from the list.',
  inputSchema: rollbackActionSchema,
  execute: async ({ context }) => {
    const { supabase, ...input } = context as z.infer<typeof rollbackActionSchema> & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to rollback tool context')
    }

    const result = await rollbackAction(supabase, input)
    if (!result.success) {
      throw new Error((result as any).error || (result as any).message || 'Unknown error')
    }
    return result
  }
})

export const rollbackTools = {
  getRecentActions: getRecentActionsTool,
  rollbackByDescription: rollbackByDescriptionTool,
  rollbackAction: rollbackActionTool
}
