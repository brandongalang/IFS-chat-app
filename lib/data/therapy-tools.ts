import 'server-only'

import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import type {
  WriteTherapyDataInput,
  QueryTherapyDataInput,
  UpdateTherapyDataInput,
  GetSessionContextInput,
  SessionContextResponse,
} from './therapy-tools.schema'
import {
  writeTherapyDataSchema,
  queryTherapyDataSchema,
  updateTherapyDataSchema,
  getSessionContextSchema,
  sessionContextResponseSchema,
} from './therapy-tools.schema'
import * as serverHelpers from './schema/server'

export type PrdServerDeps = {
  userId: string
  client?: SupabaseDatabaseClient
}

export async function writeTherapyData(
  input: WriteTherapyDataInput,
  deps: PrdServerDeps
): Promise<{ success: true; id: string; type: string } | { success: false; error: string }> {
  try {
    const validated = writeTherapyDataSchema.parse(input)

    switch (validated.type) {
      case 'observation': {
        const result = await serverHelpers.recordObservation(
          {
            content: validated.data.content || '',
            type: (validated.data.observationType as any) || 'note',
            metadata: validated.data.metadata || {},
            entities: [],
          },
          deps
        )
        return { success: true, id: result.id, type: 'observation' }
      }

      case 'part': {
        const result = await serverHelpers.upsertPart(
          {
            name: validated.data.name,
            placeholder: validated.data.placeholder || undefined,
            category: validated.data.category,
            status: validated.data.status,
            data: validated.data.metadata || {},
          },
          deps
        )
        return { success: true, id: result.id, type: 'part' }
      }

      case 'relationship': {
        if (!validated.data.partIds || validated.data.partIds.length < 2) {
          return {
            success: false,
            error: 'Relationship requires at least 2 partIds',
          }
        }
        const [partA, partB] = validated.data.partIds
        const result = await serverHelpers.upsertRelationshipRecord(
          {
            part_a_id: partA,
            part_b_id: partB,
            type: (validated.data.relationshipType as any) || 'supports',
            strength: 0.5,
          },
          deps
        )
        return { success: true, id: result.id, type: 'relationship' }
      }

      case 'session_note': {
        const result = await serverHelpers.recordObservation(
          {
            content: validated.data.content || '',
            type: 'note',
            metadata: {
              ...validated.data.metadata,
              isSessionNote: true,
            },
            entities: [],
          },
          deps
        )
        return { success: true, id: result.id, type: 'session_note' }
      }

      default:
        return { success: false, error: `Unknown write type: ${(validated as any).type}` }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function queryTherapyData(
  input: QueryTherapyDataInput,
  deps: PrdServerDeps
): Promise<any[] | { success: false; error: string }> {
  try {
    const validated = queryTherapyDataSchema.parse(input)

    switch (validated.type) {
      case 'parts': {
        const results = await serverHelpers.searchParts(
          {
            query: validated.filters?.search,
            category: validated.filters?.category as any,
            status: validated.filters?.status as any,
            limit: validated.limit,
          },
          deps
        )
        return results
      }

      case 'observations': {
        const results = await serverHelpers.recentObservations(
          {
            limit: validated.limit,
            type: validated.filters?.search ? (validated.filters.search as any) : undefined,
          },
          deps
        )
        return results
      }

      case 'sessions': {
        const results = await serverHelpers.listSessionRecords(deps, validated.limit)
        return results
      }

      case 'relationships': {
        const results = await serverHelpers.listRelationshipRecords(
          deps,
          validated.filters?.category ? { partId: validated.filters.category } : undefined
        )
        return results
      }

      case 'timeline': {
        const results = await serverHelpers.listTimelineEventRecords(deps, validated.limit)
        return results
      }

      default:
        return { success: false, error: `Unknown query type: ${(validated as any).type}` }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateTherapyData(
  input: UpdateTherapyDataInput,
  deps: PrdServerDeps
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const validated = updateTherapyDataSchema.parse(input)

    switch (validated.type) {
      case 'part': {
        await serverHelpers.upsertPart(
          {
            id: validated.id,
            ...validated.updates,
          },
          deps
        )
        return { success: true, id: validated.id }
      }

      case 'observation': {
        const completed = validated.updates.completed || false
        const metadata = validated.updates.metadata || {}
        await serverHelpers.updateObservation(validated.id, { completed, metadata }, deps)
        return { success: true, id: validated.id }
      }

      case 'session': {
        await serverHelpers.completeSessionRecord(
          validated.id,
          {
            summary: validated.updates.summary,
            key_insights: validated.updates.key_insights,
            homework: validated.updates.homework,
            next_session: validated.updates.next_session,
          },
          deps
        )
        return { success: true, id: validated.id }
      }

      default:
        return { success: false, error: `Unknown update type: ${(validated as any).type}` }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getSessionContext(
  input: GetSessionContextInput,
  deps: PrdServerDeps
): Promise<SessionContextResponse | { success: false; error: string }> {
  try {
    getSessionContextSchema.parse(input)

    const cache = await serverHelpers.loadUserContextCache(deps)
    if (!cache) {
      return {
        timeSinceLastContact: 'Unknown',
        lastTopics: [],
        openThreads: [],
        partsActive: [],
        suggestedFocus: 'Check in on recent activity',
      }
    }

    const lastObservation = cache.last_observation_at
      ? new Date(cache.last_observation_at)
      : new Date()
    const now = new Date()
    const hoursSince = Math.floor(
      (now.getTime() - lastObservation.getTime()) / (1000 * 60 * 60)
    )
    let timeSinceLastContact = 'just now'
    if (hoursSince === 1) {
      timeSinceLastContact = '1 hour ago'
    } else if (hoursSince > 1 && hoursSince < 24) {
      timeSinceLastContact = `${hoursSince} hours ago`
    } else if (hoursSince >= 24) {
      const daysSince = Math.floor(hoursSince / 24)
      timeSinceLastContact = daysSince === 1 ? '1 day ago' : `${daysSince} days ago`
    }

    const partsActive = (cache.recent_parts || []).map((p: any) => ({
      id: p.id,
      name: p.display_name || 'Unnamed Part',
      lastActive: p.last_active,
      triggers: [],
    }))

    const lastTopics: string[] = []
    const openThreads: string[] = []

    if (cache.last_session?.next_session) {
      lastTopics.push(...(cache.last_session.next_session || []))
    }
    if (cache.last_session?.homework) {
      openThreads.push(...(cache.last_session.homework || []))
    }
    if (cache.follow_ups) {
      openThreads.push(...cache.follow_ups.map((f: any) => f.content || ''))
    }

    let suggestedFocus = 'Continue exploring'
    if (cache.incomplete_parts && cache.incomplete_parts.length > 0) {
      suggestedFocus = `Work on completing part details (${cache.incomplete_parts.length} parts need attention)`
    } else if (openThreads.length > 0) {
      suggestedFocus = `Follow up on: ${openThreads[0]}`
    }

    const response: SessionContextResponse = {
      timeSinceLastContact,
      lastTopics,
      openThreads,
      partsActive,
      suggestedFocus,
      upcomingReminders: openThreads.slice(0, 3),
    }

    return sessionContextResponseSchema.parse(response)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
