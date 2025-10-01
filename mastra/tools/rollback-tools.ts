import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import { createActionLogger } from '@/lib/database/action-logger'
import { getServerSupabaseClient } from '@/lib/supabase/clients'

const getRecentActionsSchema = z
  .object({
    limit: z.number().min(1).max(50).default(10).describe('Maximum number of recent actions to return'),
    actionTypes: z
      .array(
        z.enum([
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
          'end_session',
        ])
      )
      .optional()
      .describe('Filter by specific action types'),
    sessionId: z.string().uuid().optional().describe('Filter by specific session'),
    withinMinutes: z.number().min(1).max(1440).default(30).describe('Only show actions within this many minutes'),
  })
  .strict()

const rollbackByDescriptionSchema = z
  .object({
    description: z
      .string()
      .min(3)
      .describe(
        'Natural language description of the action to rollback (e.g., "increased Inner Critic confidence", "created Perfectionist part")'
      ),
    reason: z.string().default('User requested rollback').describe('Reason for the rollback'),
    withinMinutes: z.number().min(1).max(1440).default(30).describe('Only look for actions within this timeframe'),
  })
  .strict()

const rollbackActionSchema = z
  .object({
    actionId: z.string().uuid().describe('ID of the specific action to rollback (from getRecentActions)'),
    reason: z.string().default('Agent rollback').describe('Reason for rolling back this action'),
  })
  .strict()

function ensureUserId(baseUserId: string | undefined, runtime?: { userId?: string }) {
  return resolveUserId(runtime?.userId ?? baseUserId)
}

async function resolveLogger(baseUserId: string | undefined, runtime?: { userId?: string }) {
  const userId = ensureUserId(baseUserId, runtime)
  const client = await getServerSupabaseClient()
  const logger = createActionLogger(client)
  return { logger, userId }
}

export function createRollbackTools(userId?: string) {
  const getRecentActionsTool = createTool({
    id: 'getRecentActions',
    description: 'Get recent agent actions for review and potential rollback. Use this first to see what actions can be undone.',
    inputSchema: getRecentActionsSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof getRecentActionsSchema>; runtime?: { userId?: string } }) => {
      const input = getRecentActionsSchema.parse(context)
      const { logger, userId: resolvedUserId } = await resolveLogger(userId, runtime)
      const actions = await logger.getActionEvents(resolvedUserId, input.limit, input.withinMinutes)
      return actions
    },
  })

  const rollbackByDescriptionTool = createTool({
    id: 'rollbackByDescription',
    description:
      'Rollback an agent action using natural language description. Use when user says things like "undo that confidence change" or "remove that new part".',
    inputSchema: rollbackByDescriptionSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof rollbackByDescriptionSchema>; runtime?: { userId?: string } }) => {
      const input = rollbackByDescriptionSchema.parse(context)
      const { logger, userId: resolvedUserId } = await resolveLogger(userId, runtime)
      const result = await logger.rollbackByDescription(resolvedUserId, input.description, input.reason, input.withinMinutes)
      if (!result.success) {
        throw new Error(result.message)
      }
      return result
    },
  })

  const rollbackActionTool = createTool({
    id: 'rollbackAction',
    description: 'Rollback a specific action by ID. Use after getRecentActions to rollback a specific action from the list.',
    inputSchema: rollbackActionSchema,
    execute: async ({ context, runtime }: { context: z.infer<typeof rollbackActionSchema>; runtime?: { userId?: string } }) => {
      const input = rollbackActionSchema.parse(context)
      const { logger } = await resolveLogger(userId, runtime)
      const result = await logger.rollbackAction(input.actionId, input.reason)
      if (!result.success) {
        throw new Error(result.message)
      }
      return result
    },
  })

  return {
    getRecentActions: getRecentActionsTool,
    rollbackByDescription: rollbackByDescriptionTool,
    rollbackAction: rollbackActionTool,
  }
}

export type RollbackTools = ReturnType<typeof createRollbackTools>
