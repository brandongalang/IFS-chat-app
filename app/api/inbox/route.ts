import { NextRequest } from 'next/server'
import { getUserClient } from '@/lib/supabase/clients'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { rankInboxItems, type RankedInboxItem } from '@/lib/data/inbox-ranking'
import { mapInboxRowToItem, mapInboxItemToEnvelope, type InboxItemRow } from '@/lib/data/inbox-items'
import type { InboxEnvelope, InboxFeedResponse } from '@/types/inbox'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const SUPABASE_FETCH_LIMIT = 200

type CursorPayload = {
  rankBucket: number
  createdAt: string
  id: string
}

function parseLimit(limitParam: string | null): number | null {
  if (!limitParam) return DEFAULT_LIMIT

  const parsed = Number.parseInt(limitParam, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null
  }

  return Math.min(parsed, MAX_LIMIT)
}

function decodeCursor(afterParam: string | null): CursorPayload | null {
  if (!afterParam) return null

  try {
    const decoded = Buffer.from(afterParam, 'base64url').toString('utf8')
    const payload = JSON.parse(decoded) as Partial<CursorPayload>

    if (
      typeof payload.rankBucket === 'number' &&
      typeof payload.createdAt === 'string' &&
      typeof payload.id === 'string'
    ) {
      return {
        rankBucket: payload.rankBucket,
        createdAt: payload.createdAt,
        id: payload.id,
      }
    }
  } catch (error) {
    console.error('Failed to decode inbox cursor', error)
  }

  return null
}

function encodeCursor(item: RankedInboxItem): string {
  const payload: CursorPayload = {
    rankBucket: item.rankBucket,
    createdAt: item.createdAt,
    id: item.id,
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function findCursorIndex(items: RankedInboxItem[], cursor: CursorPayload) {
  return items.findIndex((item) => {
    return (
      item.rankBucket === cursor.rankBucket &&
      item.createdAt === cursor.createdAt &&
      item.id === cursor.id
    )
  })
}

function paginateItems(
  rankedItems: RankedInboxItem[],
  limit: number,
  cursor: CursorPayload | null
) {
  let startIndex = 0

  if (cursor) {
    const index = findCursorIndex(rankedItems, cursor)
    if (index === -1) {
      return {
        page: [] as RankedInboxItem[],
        nextCursor: null,
        cursorInvalid: true,
      }
    }

    startIndex = index + 1
  }

  const page = rankedItems.slice(startIndex, startIndex + limit)
  const hasNext = startIndex + limit < rankedItems.length
  const nextCursor = hasNext ? encodeCursor(rankedItems[startIndex + limit]) : null

  return { page, nextCursor, cursorInvalid: false }
}

export async function GET(request: NextRequest) {
  const supabase = getUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  const url = new URL(request.url)
  const limitParam = url.searchParams.get('limit')
  const afterParam = url.searchParams.get('after')

  const limit = parseLimit(limitParam)
  if (!limit) {
    return errorResponse('Invalid limit parameter', HTTP_STATUS.BAD_REQUEST)
  }

  const cursor = decodeCursor(afterParam)
  if (afterParam && !cursor) {
    return errorResponse('Invalid cursor parameter', HTTP_STATUS.BAD_REQUEST)
  }

  try {
    const { data, error } = await supabase
      .from('inbox_items_view')
      .select('*')
      .eq('user_id', user.id)
      .limit(Math.min(SUPABASE_FETCH_LIMIT, Math.max(limit * 3, limit + 20)))

    if (error) {
      console.error('Failed to fetch inbox items', error)
      return errorResponse('Failed to fetch inbox items', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    const items = (data ?? []).map((row: InboxItemRow) => mapInboxRowToItem(row))
    const rankedItems = rankInboxItems(items)
    const { page, nextCursor, cursorInvalid } = paginateItems(rankedItems, limit, cursor)

    if (cursorInvalid) {
      return errorResponse('Cursor no longer valid', HTTP_STATUS.BAD_REQUEST)
    }

    const envelopes: InboxEnvelope[] = page
      .map((item) => mapInboxItemToEnvelope(item))
      .filter((envelope): envelope is InboxEnvelope => Boolean(envelope))

    if (envelopes.length) {
      const deliveredRows = envelopes.map((envelope) => ({
        subject_id: envelope.id,
        user_id: user.id,
        envelope_type: envelope.type,
        source_type: envelope.source,
        event_type: 'delivered' as const,
        action_value: null,
        notes: null,
        attributes: { deliveredAt: new Date().toISOString() },
      }))

      const { error: deliveredError } = await supabase
        .from('inbox_message_events')
        .upsert(deliveredRows, { onConflict: 'user_id,subject_id,event_type', ignoreDuplicates: true })

      if (deliveredError) {
        console.error('Failed to record delivered inbox events', deliveredError)
      }
    }

    const response: InboxFeedResponse = {
      data: envelopes,
      generatedAt: new Date().toISOString(),
      source: envelopes.length ? envelopes[0]?.source ?? 'supabase' : 'supabase',
      variant: 'pragmatic',
      nextCursor,
      reason: envelopes.length ? undefined : 'no_items',
    }

    return jsonResponse(response)
  } catch (error) {
    console.error('Unexpected inbox GET error', error)
    return errorResponse('An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
