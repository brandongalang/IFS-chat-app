import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, HTTP_STATUS } from '@/lib/api/response'
import { isInboxActionsEnabled, isInboxEnabled } from '@/config/features'
import type { InboxActionRequest } from '@/types/inbox'
import { readJsonBody, isRecord } from '@/lib/api/request'

export async function POST(req: NextRequest) {
  if (!isInboxEnabled()) {
    return errorResponse('Inbox disabled', HTTP_STATUS.NOT_FOUND)
  }
  if (!isInboxActionsEnabled()) {
    return errorResponse('Inbox actions disabled', HTTP_STATUS.FORBIDDEN)
  }

  const raw = await readJsonBody(req)
  if (!isRecord(raw) || typeof raw.subjectId !== 'string') {
    return errorResponse('subjectId is required', HTTP_STATUS.BAD_REQUEST)
  }

  const payload: InboxActionRequest = {
    subjectId: raw.subjectId,
    eventType: typeof raw.eventType === 'string' ? raw.eventType : undefined,
    action: typeof raw.action === 'string' ? raw.action : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  const eventType = payload.eventType ?? 'cta_clicked'
  const attributes: Record<string, unknown> = {}
  if (payload.action) attributes.action = payload.action
  if (payload.notes) attributes.notes = payload.notes

  const { error } = await supabase.from('inbox_message_events').insert({
    subject_id: payload.subjectId,
    user_id: user.id,
    event_type: eventType,
    attributes,
  })

  if (error) {
    console.error('[api/inbox/events] failed to insert event', error)
    return errorResponse('Failed to record inbox event', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  return new NextResponse(null, { status: HTTP_STATUS.NO_CONTENT })
}
