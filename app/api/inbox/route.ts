import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { rankInboxItems, type RankedInboxItem } from '@/lib/data/inbox-ranking'
import type { InboxContent, InboxItem, PaginatedInboxResponse } from '@/types/inbox'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const SUPABASE_FETCH_LIMIT = 200

type InboxItemRow = {
  id: string
  user_id: string
  source_type: string
  status: string
  part_id: string | null
  content: unknown
  metadata: unknown
  created_at: string
}

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

function mapRowToItem(row: InboxItemRow): InboxItem {
  return {
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type,
    status: row.status,
    partId: row.part_id,
    content: normalizeContent(row.content),
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
  }
}

function normalizeContent(content: unknown): InboxContent | null {
  if (content == null) return null

  if (typeof content === 'string') {
    try {
      return JSON.parse(content)
    } catch {
      return { value: content }
    }
  }

  if (typeof content === 'object') {
    return content as InboxContent
  }

  return null
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata == null) return null

  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata) as Record<string, unknown>
    } catch {
      return { value: metadata }
    }
  }

  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>
  }

  return null
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
  const supabase = await createClient()
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

    const items = (data ?? []).map((row: InboxItemRow) => mapRowToItem(row))
    const rankedItems = rankInboxItems(items)
    const { page, nextCursor, cursorInvalid } = paginateItems(rankedItems, limit, cursor)

    if (cursorInvalid) {
      return errorResponse('Cursor no longer valid', HTTP_STATUS.BAD_REQUEST)
    }

    const response: PaginatedInboxResponse = {
      items: page,
      nextCursor,
    }

    return jsonResponse(response)
  } catch (error) {
    console.error('Unexpected inbox GET error', error)
    return errorResponse('An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
