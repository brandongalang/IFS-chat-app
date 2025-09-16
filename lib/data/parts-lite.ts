import { z } from 'zod'
import type { PartRow } from '@/lib/types/database'

const searchPartsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['emerging', 'acknowledged', 'active', 'integrated']).optional(),
  category: z.enum(['manager', 'firefighter', 'exile', 'unknown']).optional(),
  limit: z.number().min(1).max(50).default(20),
})

const getPartByIdSchema = z.object({
  partId: z.string().uuid(),
})

const getPartRelationshipsSchema = z.object({
  partId: z.string().uuid().optional(),
  relationshipType: z.enum(['polarized', 'protector-exile', 'allied']).optional(),
  status: z.enum(['active', 'healing', 'resolved']).optional(),
  includePartDetails: z.boolean().default(false),
  limit: z.number().min(1).max(50).default(20),
})

async function fetchJson<T>(path: string, params?: URLSearchParams): Promise<T> {
  const query = params && params.toString().length > 0 ? `?${params.toString()}` : ''
  const response = await fetch(`${path}${query}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const text = await response.text()
  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as any).error === 'string'
        ? (payload as any).error
        : `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export async function searchParts(input: z.infer<typeof searchPartsSchema>): Promise<PartRow[]> {
  const validated = searchPartsSchema.parse(input)
  const params = new URLSearchParams()

  if (validated.query) {
    params.set('query', validated.query)
  }
  if (validated.status) {
    params.set('status', validated.status)
  }
  if (validated.category) {
    params.set('category', validated.category)
  }
  if (typeof validated.limit === 'number') {
    params.set('limit', String(validated.limit))
  }

  return fetchJson<PartRow[]>('/api/parts', params)
}

export async function getPartById(input: z.infer<typeof getPartByIdSchema>): Promise<PartRow | null> {
  const validated = getPartByIdSchema.parse(input)

  try {
    return await fetchJson<PartRow>(`/api/parts/${validated.partId}`)
  } catch (error) {
    if (error instanceof Error && error.message === 'Part not found') {
      return null
    }
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

export async function getPartRelationships(input: z.infer<typeof getPartRelationshipsSchema>): Promise<Array<any>> {
  const validated = getPartRelationshipsSchema.parse(input)
  const params = new URLSearchParams()

  if (validated.partId) {
    params.set('partId', validated.partId)
  }
  if (validated.relationshipType) {
    params.set('relationshipType', validated.relationshipType)
  }
  if (validated.status) {
    params.set('status', validated.status)
  }
  if (validated.includePartDetails) {
    params.set('includePartDetails', 'true')
  }
  if (typeof validated.limit === 'number') {
    params.set('limit', String(validated.limit))
  }

  return fetchJson<Array<any>>('/api/parts/relationships', params)
}
