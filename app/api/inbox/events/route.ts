import { NextRequest, NextResponse } from 'next/server'
import { getUserClient } from '@/lib/supabase/clients'
import { errorResponse, HTTP_STATUS } from '@/lib/api/response'
import { isInboxActionsEnabled, isInboxEnabled } from '@/config/features'
import type { InboxActionRequest, InboxEventType, InboxEnvelopeSource, InboxMessageType } from '@/types/inbox'
import { isValidUuid, shouldPersistInboxEvent } from './helpers'

const allowedEventTypes: InboxEventType[] = ['delivered', 'opened', 'actioned']

export async function POST(req: NextRequest) {
  if (!isInboxEnabled()) {
    return errorResponse('Inbox disabled', HTTP_STATUS.NOT_FOUND)
  }
  if (!isInboxActionsEnabled()) {
    return errorResponse('Inbox actions disabled', HTTP_STATUS.FORBIDDEN)
  }

  const payload = (await req.json()) as InboxActionRequest
  if (!payload?.subjectId) {
    return errorResponse('subjectId is required', HTTP_STATUS.BAD_REQUEST)
  }

  const supabase = getUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  const eventType = (payload.eventType ?? 'actioned') as InboxEventType
  if (!allowedEventTypes.includes(eventType)) {
    return errorResponse('Invalid event type', HTTP_STATUS.BAD_REQUEST)
  }

  const messageType: InboxMessageType = (payload.messageType ?? 'insight_spotlight') as InboxMessageType
  const source: InboxEnvelopeSource | 'fallback' = (payload.source ?? 'supabase') as InboxEnvelopeSource | 'fallback'

  if (!shouldPersistInboxEvent(payload.subjectId, source)) {
    return new NextResponse(null, { status: HTTP_STATUS.NO_CONTENT })
  }

  const attributes: Record<string, unknown> = {
    ...(payload.attributes ?? {}),
  }
  if (payload.action) attributes.actionValue = payload.action
  if (payload.notes) attributes.notes = payload.notes

  const { error } = await supabase.from('inbox_message_events').insert({
    subject_id: payload.subjectId,
    user_id: user.id,
    envelope_type: messageType,
    source_type: source,
    event_type: eventType,
    action_value: payload.action ?? null,
    notes: payload.notes ?? null,
    attributes,
  })

  if (error) {
    console.error('[api/inbox/events] failed to insert event', error)
    return errorResponse('Failed to record inbox event', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  return new NextResponse(null, { status: HTTP_STATUS.NO_CONTENT })
}
