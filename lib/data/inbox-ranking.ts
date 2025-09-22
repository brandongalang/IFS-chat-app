import type { InboxItem } from '@/types/inbox'

export interface RankedInboxItem extends InboxItem {
  rankBucket: number
}

const STATUS_PRIORITY: Record<string, number> = {
  revealed: 0,
  pending: 1,
  snoozed: 2,
  dismissed: 3,
}

const SOURCE_PRIORITY: Record<string, number> = {
  insight: 0,
  follow_up: 1,
  part_follow_up: 1,
}

function getRankBucket(item: InboxItem): number {
  const statusPriority = STATUS_PRIORITY[item.status] ?? 50
  const sourcePriority = SOURCE_PRIORITY[item.sourceType] ?? 10
  return statusPriority * 10 + sourcePriority
}

function compareCreatedAtDesc(a: InboxItem, b: InboxItem): number {
  const timeA = new Date(a.createdAt).getTime()
  const timeB = new Date(b.createdAt).getTime()

  if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0
  if (Number.isNaN(timeA)) return 1
  if (Number.isNaN(timeB)) return -1

  return timeB - timeA
}

export function rankInboxItems(items: InboxItem[]): RankedInboxItem[] {
  return items
    .map((item) => ({
      ...item,
      rankBucket: getRankBucket(item),
    }))
    .sort((a, b) => {
      if (a.rankBucket === b.rankBucket) {
        return compareCreatedAtDesc(a, b)
      }
      return a.rankBucket - b.rankBucket
    })
}
