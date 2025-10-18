/**
 * Freshness utilities for garden UI
 * Determines temporal state of a part based on last_active timestamp
 */

interface FreshnessState {
  label: string
  emoji: string
  color: string
}

export function getFreshness(lastActive: string | null): FreshnessState {
  if (!lastActive) {
    return {
      label: 'Never active',
      emoji: '⚪',
      color: 'text-gray-400',
    }
  }

  const now = new Date()
  const then = new Date(lastActive)
  const msAgo = now.getTime() - then.getTime()
  const hoursAgo = msAgo / (1000 * 60 * 60)

  if (hoursAgo < 1) {
    return {
      label: 'Active just now',
      emoji: '🔴',
      color: 'text-emerald-400',
    }
  }

  if (hoursAgo < 24) {
    const hours = Math.floor(hoursAgo)
    return {
      label: `Active ${hours}h ago`,
      emoji: '🟢',
      color: 'text-emerald-300',
    }
  }

  if (hoursAgo < 168) {
    const days = Math.floor(hoursAgo / 24)
    return {
      label: `Active ${days}d ago`,
      emoji: '🟡',
      color: 'text-amber-300',
    }
  }

  return {
    label: `Last seen ${then.toLocaleDateString()}`,
    emoji: '⚪',
    color: 'text-gray-400',
  }
}
