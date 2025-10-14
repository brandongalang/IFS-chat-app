import { z } from 'zod'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import { timelineEventRowSchema, type TimelineEventRow } from './types'

const createTimelineEventInputSchema = z
  .object({
    session_id: z.string().uuid().nullable().optional(),
    type: z.enum(['part_emerged', 'breakthrough', 'integration', 'relationship_discovered']),
    description: z.string().nullable().optional(),
    entities: z.array(z.string().uuid()).default([]),
    metadata: z.record(z.any()).default({}),
  })
  .strict()

export type CreateTimelineEventInput = z.infer<typeof createTimelineEventInputSchema>

export async function createTimelineEvent(
  input: CreateTimelineEventInput,
  deps: PrdDataDependencies
): Promise<TimelineEventRow> {
  const payload = createTimelineEventInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)

  const { data, error } = await client
    .from('timeline_events')
    .insert({
      ...payload,
      user_id: userId,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create timeline event: ${error.message}`)
  }

  return timelineEventRowSchema.parse(data)
}

export async function listTimelineEvents(
  deps: PrdDataDependencies,
  limit = 50
): Promise<TimelineEventRow[]> {
  const { client, userId } = assertPrdDeps(deps)
  const { data, error } = await client
    .from('timeline_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list timeline events: ${error.message}`)
  }

  return (data ?? []).map((row) => timelineEventRowSchema.parse(row))
}
