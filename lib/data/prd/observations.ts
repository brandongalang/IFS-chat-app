import { z } from 'zod'
import { assertPrdDeps, prdClient, type PrdDataDependencies } from './utils'
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

export async function createObservation(
  input: CreateObservationInput,
  deps: PrdDataDependencies
): Promise<ObservationRow> {
  const payload = createObservationInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)
  const supabase = prdClient(client)

  const { data, error } = await supabase
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

export async function listObservations(
  input: ListObservationsInput,
  deps: PrdDataDependencies
): Promise<ObservationRow[]> {
  const filters = listObservationsInputSchema.parse(input)
  const { client, userId } = assertPrdDeps(deps)
  const supabase = prdClient(client)

  let query = supabase
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

export async function updateObservationFollowUp(
  observationId: string,
  updates: { completed?: boolean; metadata?: Record<string, any> },
  deps: PrdDataDependencies
): Promise<ObservationRow> {
  const { client, userId } = assertPrdDeps(deps)
  const supabase = prdClient(client)
  const patch: Record<string, unknown> = {}

  if (typeof updates.completed === 'boolean') {
    patch.metadata = {
      ...(updates.metadata ?? {}),
      completed: updates.completed ? 'true' : null,
    }
  } else if (updates.metadata) {
    patch.metadata = updates.metadata
  }

  const { data, error } = await supabase
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
