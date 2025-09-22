import { NextRequest } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { getInboxItemById } from '@/lib/data/inbox-items'
import type { InboxItem } from '@/types/inbox'
import type { Database } from '@/lib/types/database'
import {
  confirmInboxItemAction,
  dismissInboxItemAction,
  snoozeInboxItemAction,
  type ConfirmInboxActionPayload,
  type DismissInboxActionPayload,
  type SnoozeInboxActionPayload,
} from '@/lib/data/inbox-actions'

const confirmActionSchema = z.object({
  action: z.literal('confirm'),
  note: z.string().trim().max(1000).optional(),
})

const dismissActionSchema = z.object({
  action: z.literal('dismiss'),
  reason: z.string().trim().max(1000).optional(),
})

const snoozeActionSchema = z.object({
  action: z.literal('snooze'),
  snoozeUntil: z.coerce.date(),
  reason: z.string().trim().max(1000).optional(),
})

const payloadSchema = z.discriminatedUnion('action', [
  confirmActionSchema,
  dismissActionSchema,
  snoozeActionSchema,
])

type RouteContext = {
  params: {
    id?: string
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const supabase = (await createClient()) as SupabaseClient<Database>
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  const { params } = context
  const { id } = params

  if (!id) {
    return errorResponse('Missing inbox item id', HTTP_STATUS.BAD_REQUEST)
  }

  const payloadJson = await request
    .json()
    .catch(() => null)

  if (!payloadJson) {
    return errorResponse('Invalid JSON body', HTTP_STATUS.BAD_REQUEST)
  }

  const parsedPayload = payloadSchema.safeParse(payloadJson)
  if (!parsedPayload.success) {
    return errorResponse('Invalid action payload', HTTP_STATUS.BAD_REQUEST)
  }

  const payload = parsedPayload.data

  let inboxItem: InboxItem | null
  try {
    inboxItem = await getInboxItemById(supabase, id, user.id)
  } catch (error) {
    console.error('Failed to fetch inbox item context', error)
    return errorResponse('Failed to load inbox item', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  if (!inboxItem) {
    return errorResponse('Inbox item not found', HTTP_STATUS.NOT_FOUND)
  }

  try {
    let updatedItem: InboxItem

    switch (payload.action) {
      case 'confirm': {
        const actionPayload: ConfirmInboxActionPayload = {
          note: payload.note,
        }

        updatedItem = await confirmInboxItemAction({
          supabase,
          item: inboxItem,
          userId: user.id,
          payload: actionPayload,
        })
        break
      }
      case 'dismiss': {
        const actionPayload: DismissInboxActionPayload = {
          reason: payload.reason,
        }

        updatedItem = await dismissInboxItemAction({
          supabase,
          item: inboxItem,
          userId: user.id,
          payload: actionPayload,
        })
        break
      }
      case 'snooze': {
        const actionPayload: SnoozeInboxActionPayload = {
          snoozeUntil: payload.snoozeUntil,
          reason: payload.reason,
        }

        updatedItem = await snoozeInboxItemAction({
          supabase,
          item: inboxItem,
          userId: user.id,
          payload: actionPayload,
        })
        break
      }
      default:
        return errorResponse('Unsupported action', HTTP_STATUS.BAD_REQUEST)
    }

    return jsonResponse({ item: updatedItem })
  } catch (error) {
    console.error('Failed to process inbox action', error)
    return errorResponse('Failed to process action', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
