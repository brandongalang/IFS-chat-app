import type { SupabaseClient } from '@supabase/supabase-js'

import { DatabaseActionLogger } from '@/lib/database/action-logger'
import { getInboxItemById } from '@/lib/data/inbox-items'
import type { InboxItem, InboxQuickActionValue } from '@/types/inbox'
import type { Database, InsightRow, InsightUpdate, PartRow, PartUpdate } from '@/lib/types/database'

export type ConfirmInboxActionPayload = {
  note?: string
  actionValue: 'agree_strong' | 'agree' | 'ack'
}

export type DismissInboxActionPayload = {
  reason?: string
  actionValue: InboxQuickActionValue
}

export type SnoozeInboxActionPayload = {
  snoozeUntil: Date
  reason?: string
}

type ActionContext<Payload> = {
  supabase: SupabaseClient<Database>
  item: InboxItem
  userId: string
  payload: Payload
}

export async function confirmInboxItemAction({
  supabase,
  item,
  userId,
  payload,
}: ActionContext<ConfirmInboxActionPayload>): Promise<InboxItem> {
  if (item.sourceType === 'insight') {
    const actionLogger = new DatabaseActionLogger(supabase)
    const now = new Date().toISOString()
    const note = payload.note?.trim() || undefined

    const { data: insightRow, error: insightError } = await supabase
      .from('insights')
      .select('id,status,meta,revealed_at')
      .eq('id', item.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (insightError) {
      throw insightError
    }

    if (!insightRow) {
      throw new Error('Insight not found for confirmation')
    }

    const insight = insightRow as Pick<InsightRow, 'id' | 'status' | 'meta' | 'revealed_at'>

    const insightUpdate: Partial<InsightUpdate> = {}
    insightUpdate.status = 'actioned'
    insightUpdate.actioned_at = now
    if (!insight.revealed_at) {
      insightUpdate.revealed_at = now
    }

    const metaRecord = toRecord(insight.meta)
    const confirmationMeta = toRecord(metaRecord.confirmation)
    confirmationMeta.last_confirmed_at = now
    confirmationMeta.last_value = payload.actionValue
    if (note) {
      confirmationMeta.note = note
      confirmationMeta.note_updated_at = now
    }

    const responseMeta = toRecord(metaRecord.inbox_response)
    responseMeta.last_value = payload.actionValue
    responseMeta.last_recorded_at = now
    if (note) {
      responseMeta.note = note
    }

    const updatedMeta = {
      ...metaRecord,
      confirmation: confirmationMeta,
      inbox_response: responseMeta,
    }

    insightUpdate.meta = updatedMeta as InsightUpdate['meta']

    await actionLogger.loggedUpdate<InsightRow>('insights', insight.id, insightUpdate, userId, 'confirm_insight', {
      changeDescription: 'User confirmed inbox insight',
      ...(note ? { note } : {}),
      responseValue: payload.actionValue,
    })

    if (item.partId) {
      await touchRelatedPart({
        supabase,
        actionLogger,
        partId: item.partId,
        userId,
        note,
        timestamp: now,
      })
    }

    const refreshedItem = await getInboxItemById(supabase, item.id, userId)
    if (!refreshedItem) {
      throw new Error('Failed to load updated inbox item')
    }

    return refreshedItem
  }

  if (item.sourceType === 'observation') {
    return confirmObservationInboxItem({
      supabase,
      item,
      userId,
      payload,
    })
  }

  throw new Error('Confirm action is only supported for insight or observation inbox items')
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

type PartTouchContext = {
  supabase: SupabaseClient<Database>
  actionLogger: DatabaseActionLogger
  partId: string
  userId: string
  timestamp: string
  note?: string
}

async function touchRelatedPart({
  supabase,
  actionLogger,
  partId,
  userId,
  timestamp,
  note,
}: PartTouchContext): Promise<void> {
  const { data: partRow, error } = await supabase
    .from('parts')
    .select('id,name,status,acknowledged_at')
    .eq('id', partId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!partRow) {
    return
  }

  const updates: Partial<PartUpdate> = {
    last_active: timestamp,
  }

  if (!partRow.acknowledged_at) {
    updates.acknowledged_at = timestamp
  }

  if (partRow.status === 'emerging') {
    updates.status = 'acknowledged'
  }

  await actionLogger.loggedUpdate<PartRow>('parts', partRow.id, updates, userId, 'acknowledge_part', {
    partName: partRow.name,
    changeDescription: 'Part touched by inbox confirmation',
    ...(note ? { note } : {}),
  })
}

async function confirmObservationInboxItem({
  supabase,
  item,
  userId,
  payload,
}: ActionContext<ConfirmInboxActionPayload>): Promise<InboxItem> {
  const timestamp = new Date().toISOString()
  const note = payload.note?.trim() || undefined

  const { data: observationRow, error } = await supabase
    .from('inbox_observations')
    .select('id,status,metadata')
    .eq('id', item.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!observationRow) {
    throw new Error('Observation not found for confirmation')
  }

  const metaRecord = toRecord(observationRow.metadata)
  const confirmationMeta = toRecord(metaRecord.confirmation)
  confirmationMeta.last_confirmed_at = timestamp
  confirmationMeta.last_value = payload.actionValue
  if (note) {
    confirmationMeta.note = note
  }

  const responseMeta = toRecord(metaRecord.inbox_response)
  responseMeta.last_value = payload.actionValue
  responseMeta.recorded_at = timestamp
  if (note) {
    responseMeta.note = note
  }

  const updatedMeta = {
    ...metaRecord,
    confirmation: confirmationMeta,
    inbox_response: responseMeta,
  }

  const { error: updateError } = await supabase
    .from('inbox_observations')
    .update({
      status: 'confirmed',
      confirmed_at: timestamp,
      action_value: payload.actionValue,
      action_timestamp: timestamp,
      metadata: updatedMeta,
    })
    .eq('id', item.id)
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  const { error: eventError } = await supabase.from('observation_events').insert({
    observation_id: item.id,
    user_id: userId,
    event_type: 'confirmed',
    payload: {
      actionValue: payload.actionValue,
      note: note ?? null,
      confirmedAt: timestamp,
    },
  })

  if (eventError) {
    throw eventError
  }

  return buildConfirmedFallback(item, timestamp, payload.actionValue, note)
}

export async function dismissInboxItemAction(
  {
    supabase,
    item,
    userId,
    payload,
  }: ActionContext<DismissInboxActionPayload>
): Promise<InboxItem> {
  const actionLogger = new DatabaseActionLogger(supabase)
  const timestamp = new Date().toISOString()
  const reason = payload.reason?.trim() || undefined

  if (item.sourceType === 'insight') {
    const updated = await dismissInsightInboxItem({
      supabase,
      actionLogger,
      item,
      userId,
      timestamp,
      reason,
      actionValue: payload.actionValue,
    })

    if (updated) {
      return updated
    }

    return buildDismissedFallback(item, timestamp, reason, payload.actionValue)
  }

  if (item.sourceType === 'observation') {
    const updated = await dismissObservationInboxItem({
      supabase,
      item,
      userId,
      timestamp,
      reason,
      actionValue: payload.actionValue,
    })

    if (updated) {
      return updated
    }

    return buildDismissedFallback(item, timestamp, reason, payload.actionValue)
  }

  if (item.sourceType === 'part_follow_up' || item.sourceType === 'follow_up') {
    const updated = await dismissPartFollowUpInboxItem({
      supabase,
      actionLogger,
      item,
      userId,
      timestamp,
      reason,
      actionValue: payload.actionValue,
    })

    if (updated) {
      return updated
    }

    return buildDismissedFallback(item, timestamp, reason, payload.actionValue)
  }

  return buildDismissedFallback(item, timestamp, reason, payload.actionValue)
}

export async function snoozeInboxItemAction(
  _context: ActionContext<SnoozeInboxActionPayload>
): Promise<InboxItem> {
  throw new Error('snoozeInboxItemAction not implemented')
}

type DismissContext = {
  supabase: SupabaseClient<Database>
  actionLogger: DatabaseActionLogger
  item: InboxItem
  userId: string
  timestamp: string
  reason?: string
  actionValue: InboxQuickActionValue
}

type ObservationDismissContext = {
  supabase: SupabaseClient<Database>
  item: InboxItem
  userId: string
  timestamp: string
  reason?: string
  actionValue: InboxQuickActionValue
}

async function dismissObservationInboxItem({
  supabase,
  item,
  userId,
  timestamp,
  reason,
  actionValue,
}: ObservationDismissContext): Promise<InboxItem | null> {
  const { data: observationRow, error } = await supabase
    .from('inbox_observations')
    .select('id,status,metadata')
    .eq('id', item.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!observationRow) {
    return null
  }

  const metaRecord = toRecord(observationRow.metadata)
  const dismissedMeta = toRecord(metaRecord.dismissed)
  dismissedMeta.dismissed_at = timestamp
  if (reason) {
    dismissedMeta.reason = reason
  }

  const responseMeta = toRecord(metaRecord.inbox_response)
  responseMeta.last_value = actionValue
  responseMeta.recorded_at = timestamp
  if (reason) {
    responseMeta.reason = reason
  }

  const updatedMeta = {
    ...metaRecord,
    dismissed: dismissedMeta,
    inbox_response: responseMeta,
  }

  const { error: updateError } = await supabase
    .from('inbox_observations')
    .update({
      status: 'dismissed',
      dismissed_at: timestamp,
      action_value: actionValue,
      action_timestamp: timestamp,
      metadata: updatedMeta,
    })
    .eq('id', item.id)
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  const { error: eventError } = await supabase.from('observation_events').insert({
    observation_id: item.id,
    user_id: userId,
    event_type: 'dismissed',
    payload: {
      actionValue,
      reason: reason ?? null,
      dismissedAt: timestamp,
    },
  })

  if (eventError) {
    throw eventError
  }

  return buildDismissedFallback(item, timestamp, reason, actionValue)
}

async function dismissInsightInboxItem({
  supabase,
  actionLogger,
  item,
  userId,
  timestamp,
  reason,
  actionValue,
}: DismissContext): Promise<InboxItem | null> {
  const { data: insightRow, error } = await supabase
    .from('insights')
    .select('id,status,meta')
    .eq('id', item.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!insightRow) {
    throw new Error('Insight not found for dismissal')
  }

  const insight = insightRow as Pick<InsightRow, 'id' | 'status' | 'meta'>

  const insightUpdate: Partial<InsightUpdate> = {
    status: 'actioned',
    actioned_at: timestamp,
  }

  const metaRecord = toRecord(insight.meta)
  const dismissedMeta = toRecord(metaRecord.dismissed)
  dismissedMeta.dismissed_at = timestamp
  if (reason) {
    dismissedMeta.reason = reason
  }

  const responseMeta = toRecord(metaRecord.inbox_response)
  responseMeta.last_value = actionValue
  responseMeta.last_recorded_at = timestamp
  if (reason) {
    responseMeta.reason = reason
  }

  insightUpdate.meta = {
    ...metaRecord,
    dismissed: dismissedMeta,
    inbox_response: responseMeta,
  } as InsightUpdate['meta']

  await actionLogger.loggedUpdate<InsightRow>('insights', insight.id, insightUpdate, userId, 'dismiss_insight', {
    changeDescription: 'User dismissed inbox insight',
    ...(reason ? { reason } : {}),
    responseValue: actionValue,
  })

  return getInboxItemById(supabase, item.id, userId)
}

async function dismissPartFollowUpInboxItem({
  supabase,
  actionLogger,
  item,
  userId,
  timestamp,
  reason,
  actionValue,
}: DismissContext): Promise<InboxItem | null> {
  if (!item.partId) {
    throw new Error('Part follow-up item missing partId')
  }

  const { data: partRow, error } = await supabase
    .from('parts')
    .select('id,name,last_interaction_at')
    .eq('id', item.partId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!partRow) {
    throw new Error('Part not found for dismissal')
  }

  const part = partRow as Pick<PartRow, 'id' | 'name'>

  const updates: Partial<PartUpdate> = {
    last_interaction_at: timestamp,
  }

  await actionLogger.loggedUpdate<PartRow>('parts', part.id, updates, userId, 'dismiss_part_follow_up', {
    partName: part.name,
    changeDescription: 'User dismissed part follow-up reminder',
    ...(reason ? { reason } : {}),
    responseValue: actionValue,
  })

  return getInboxItemById(supabase, item.id, userId)
}

function buildDismissedFallback(
  item: InboxItem,
  timestamp: string,
  reason?: string,
  actionValue?: string,
): InboxItem {
  const metadata = {
    ...(item.metadata ?? {}),
    dismissedAt: timestamp,
    ...(reason ? { dismissReason: reason } : {}),
    ...(actionValue ? { lastResponse: actionValue } : {}),
  }

  return {
    ...item,
    status: 'dismissed',
    metadata,
  }
}

function buildConfirmedFallback(
  item: InboxItem,
  timestamp: string,
  actionValue: string,
  note?: string,
): InboxItem {
  const metadata = {
    ...(item.metadata ?? {}),
    confirmedAt: timestamp,
    lastResponse: actionValue,
    ...(note ? { confirmationNote: note } : {}),
  }

  return {
    ...item,
    status: 'revealed',
    metadata,
  }
}
