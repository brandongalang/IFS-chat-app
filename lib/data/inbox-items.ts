import type { SupabaseClient } from '@supabase/supabase-js'

import type { InboxContent, InboxItem } from '@/types/inbox'
import type { Database } from '@/lib/types/database'

export type InboxItemRow = {
  id: string
  user_id: string
  source_type: string
  status: string
  part_id: string | null
  content: unknown
  metadata: unknown
  created_at: string
}

export function normalizeInboxContent(content: unknown): InboxContent | null {
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

export function normalizeInboxMetadata(metadata: unknown): Record<string, unknown> | null {
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

export function mapInboxRowToItem(row: InboxItemRow): InboxItem {
  return {
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type,
    status: row.status,
    partId: row.part_id,
    content: normalizeInboxContent(row.content),
    metadata: normalizeInboxMetadata(row.metadata),
    createdAt: row.created_at,
  }
}

export async function getInboxItemById(
  supabase: SupabaseClient<Database>,
  id: string,
  userId: string
): Promise<InboxItem | null> {
  const { data, error } = await supabase
    .from('inbox_items_view')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return mapInboxRowToItem(data as InboxItemRow)
}
