import type { InboxItem } from '@/types/inbox'

export interface RankedInboxItem extends InboxItem {
  rankBucket: number
}

function getRankBucket(item: InboxItem): number {
  const sourceType = item.sourceType.toLowerCase()
  const status = item.status.toLowerCase()

  if (sourceType === 'insight') {
    if (status === 'revealed') return 0
    if (status === 'pending') return 1
  }

  return 2
}

function compareCreatedAtDesc(a: InboxItem, b: InboxItem): number {
  const aTime = new Date(a.createdAt).getTime()
  const bTime = new Date(b.createdAt).getTime()

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
  if (Number.isNaN(aTime)) return 1
  if (Number.isNaN(bTime)) return -1

  return bTime - aTime
}

export function rankInboxItems(items: InboxItem[]): RankedInboxItem[] {
  return items
    .map((item) => ({
      ...item,
      rankBucket: getRankBucket(item),
    }))
    .sort((a, b) => {
      if (a.rankBucket !== b.rankBucket) {
        return a.rankBucket - b.rankBucket
      }

      const recencyComparison = compareCreatedAtDesc(a, b)
      if (recencyComparison !== 0) {
        return recencyComparison
      }

      return a.id.localeCompare(b.id)
    })
}
