import { z } from 'zod'
import { assertPrdDeps, type PrdDataDependencies } from './utils'
import { observationRowSchema, observationTypeEnum, type ObservationRow } from './types'

const createObservationInputSchema = z
  .object({
    session_id: z.string().uuid().optional(),
    type: observationTypeEnum,
    content: z.string().min(1),
    metadata: z.record(z.any()).default({}),
    entities: z.array(z.string().uuid()).default([]),
  })
  .strict()

export type CreateObservationInput = z.infer<typeof createObservationInputSchema>

const listObservationsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(50),
    since: z.string().datetime().optional(),
    type: observationTypeEnum.optional(),
  })
  .strict()

export type ListObservationsInput = z.infer<typeof listObservationsInputSchema>

/**
 * Insert a new observation row scoped to the current user, returning the typed record.
 */
export async function createObservation(
  input: CreateObservationInput,
  deps: PrdDataDependencies
): Promise<ObservationRow> {
  const payload = createObservationInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)

  const { data, error } = await client
    .from('observations')
    .insert({
      ...payload,
      user_id: userId,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create observation: ${error.message}`)
  }

  return observationRowSchema.parse(data)
}

/**
 * List recent observations for a user with optional filtering by type and timestamp.
 */
export async function listObservations(
  input: ListObservationsInput,
  deps: PrdDataDependencies
): Promise<ObservationRow[]> {
  const filters = listObservationsInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)

  let query = client
    .from('observations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(filters.limit)

  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.since) {
    query = query.gte('created_at', filters.since)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list observations: ${error.message}`)
  }

  return (data ?? []).map((row) => observationRowSchema.parse(row))
}

/**
 * Update follow-up metadata for an observation, preserving user scoping and validation.
 */
export async function updateObservationFollowUp(
  observationId: string,
  updates: { completed?: boolean; metadata?: Record<string, any> },
  deps: PrdDataDependencies
): Promise<ObservationRow> {
  const { client, userId } = assertPrdDeps(deps)
  const patch: Record<string, unknown> = {}

  if (typeof updates.completed === 'boolean') {
    // Store completion as strings to align with existing follow-up filters (metadata->>'completed' checks)
    patch.metadata = {
      ...(updates.metadata ?? {}),
      completed: updates.completed ? 'true' : null,
    }
  } else if (updates.metadata) {
    patch.metadata = updates.metadata
  }

  const { data, error } = await client
    .from('observations')
    .update(patch)
    .eq('id', observationId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update observation ${observationId}: ${error.message}`)
  }

  return observationRowSchema.parse(data)
}
