export type InboxItemSourceType = 'insight' | 'follow_up' | string

export type InboxItemStatus = 'pending' | 'revealed' | 'dismissed' | 'snoozed' | string

export interface InboxContent {
  title?: string
  body?: string
  evidence?: unknown
  [key: string]: unknown
}

export interface InboxItem {
  id: string
  userId: string
  sourceType: InboxItemSourceType
  status: InboxItemStatus
  partId: string | null
  content: InboxContent | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface PaginatedInboxResponse {
  items: InboxItem[]
  nextCursor: string | null
}
