import { NextRequest } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getUserClient } from '@/lib/supabase/clients'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { getInboxItemById } from '@/lib/data/inbox-items'
import type { InboxItem } from '@/types/inbox'
import type { Database } from '@/lib/types/database'
import {
  confirmInboxItemAction,
  dismissInboxItemAction,
  type ConfirmInboxActionPayload,
  type DismissInboxActionPayload,
} from '@/lib/data/inbox-actions'

// Accept any string action value to support agent-generated button values
const responseSchema = z.object({
  action: z.string().min(1).max(100),
  notes: z.string().trim().max(1000).optional(),
})

// Legacy negative action values for backwards compatibility
const NEGATIVE_ACTIONS = new Set(['disagree', 'disagree_strong', 'no', 'strong_no', 'dismiss'])

/**
 * Determine if an action value represents a positive/confirming response.
 * Treats all agent-generated button actions as positive (engagement).
 */
function isPositiveAction(action: string): boolean {
  // Explicit negative actions
  if (NEGATIVE_ACTIONS.has(action)) {
    return false
  }
  // Everything else is treated as positive/engagement
  return true
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await getUserClient() as SupabaseClient<Database>
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  const { params } = context
  const { id } = await params

  if (!id) {
    return errorResponse('Missing inbox item id', HTTP_STATUS.BAD_REQUEST)
  }

  const payloadJson = await request
    .json()
    .catch(() => null)

  if (!payloadJson) {
    return errorResponse('Invalid JSON body', HTTP_STATUS.BAD_REQUEST)
  }

  const parsedPayload = responseSchema.safeParse(payloadJson)
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
    const isPositive = isPositiveAction(payload.action)

    if (isPositive) {
      // Positive actions: confirm/engage with the item
      if (inboxItem.sourceType === 'insight' || inboxItem.sourceType === 'observation' || inboxItem.sourceType === 'observation_generated') {
        const actionPayload: ConfirmInboxActionPayload = {
          note: payload.notes,
          actionValue: payload.action,
        }

        updatedItem = await confirmInboxItemAction({
          supabase,
          item: inboxItem,
          userId: user.id,
          payload: actionPayload,
        })
      } else {
        // For other source types, still treat as dismiss for backwards compatibility
        const actionPayload: DismissInboxActionPayload = {
          reason: payload.notes,
          actionValue: payload.action,
        }

        updatedItem = await dismissInboxItemAction({
          supabase,
          item: inboxItem,
          userId: user.id,
          payload: actionPayload,
        })
      }
    } else {
      // Negative actions: dismiss the item
      const actionPayload: DismissInboxActionPayload = {
        reason: payload.notes,
        actionValue: payload.action,
      }

      updatedItem = await dismissInboxItemAction({
        supabase,
        item: inboxItem,
        userId: user.id,
        payload: actionPayload,
      })
    }

    return jsonResponse({ item: updatedItem })
  } catch (error) {
    console.error('Failed to process inbox action', error)
    return errorResponse('Failed to process action', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
