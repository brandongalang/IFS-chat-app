import { z } from 'zod'

export const writeTherapyDataSchema = z
  .object({
    type: z.enum(['observation', 'part', 'relationship', 'session_note']),
    data: z.object({
      content: z.string().optional(),
      observationType: z.string().optional(),
      name: z.string().min(1).max(100).optional(),
      placeholder: z.string().max(200).optional(),
      category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
      status: z.enum(['emerging', 'acknowledged', 'active', 'integrated']).optional(),
      partIds: z.array(z.string().uuid()).optional(),
      relationshipType: z.string().optional(),
      metadata: z.record(z.any()).optional().default({}),
    }).strict(),
    context: z
      .object({
        sessionId: z.string().uuid().optional(),
        partId: z.string().uuid().optional(),
        relatedIds: z.array(z.string().uuid()).optional(),
      })
      .optional(),
  })
  .strict()

export type WriteTherapyDataInput = z.infer<typeof writeTherapyDataSchema>

export const queryTherapyDataSchema = z
  .object({
    type: z.enum(['parts', 'observations', 'sessions', 'relationships', 'timeline']),
    filters: z
      .object({
        category: z.string().optional(),
        status: z.string().optional(),
        needsAttention: z.boolean().optional(),
        search: z.string().optional(),
        timeRange: z
          .object({
            start: z.string().datetime().optional(),
            end: z.string().datetime().optional(),
          })
          .optional(),
      })
      .optional(),
    includes: z.array(z.string()).optional().default([]),
    limit: z.number().min(1).max(100).default(20),
  })
  .strict()

export type QueryTherapyDataInput = z.infer<typeof queryTherapyDataSchema>

export const updateTherapyDataSchema = z
  .object({
    type: z.enum(['part', 'observation', 'session']),
    id: z.string().uuid(),
    updates: z.record(z.any()),
  })
  .strict()

export type UpdateTherapyDataInput = z.infer<typeof updateTherapyDataSchema>

export const getSessionContextSchema = z.object({}).strict()

export type GetSessionContextInput = z.infer<typeof getSessionContextSchema>

export const sessionContextResponseSchema = z
  .object({
    timeSinceLastContact: z.string(),
    lastTopics: z.array(z.string()),
    openThreads: z.array(z.string()),
    partsActive: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        lastActive: z.string().datetime(),
        triggers: z.array(z.string()),
      })
    ),
    suggestedFocus: z.string(),
    recentMood: z.string().optional(),
    upcomingReminders: z.array(z.string()).optional(),
  })
  .strict()

export type SessionContextResponse = z.infer<typeof sessionContextResponseSchema>
