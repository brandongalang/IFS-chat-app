import { reconstructMemory } from './service'
import type { UserMemory } from './types'
import { readOverviewSections } from './read'

export interface UnifiedUserContext {
  userMemory: UserMemory
  currentFocus?: string
  recentChanges: string[]
}

/**
 * Parse ISO timestamp from change log entry.
 * Format: "- 2025-01-15T10:30:00Z: description"
 */
function parseChangeLogEntry(line: string): { timestamp: Date; description: string } | null {
  const match = line.match(/^-\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z):\s*(.+)$/)
  if (!match) return null
  return {
    timestamp: new Date(match[1]),
    description: match[2],
  }
}

/**
 * Extract change log entries from the last 7 days.
 */
function filterRecent7Days(changeLogText: string): string[] {
  const lines = changeLogText.split('\n').filter(line => line.trim())
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recent: string[] = []
  for (const line of lines) {
    const entry = parseChangeLogEntry(line)
    if (!entry) continue
    if (entry.timestamp >= sevenDaysAgo) {
      recent.push(line)
    }
  }

  return recent
}

/**
 * Load unified user context combining UserMemory, overview focus, and recent changes.
 * Returns null if userId is invalid or data cannot be loaded.
 */
export async function loadUnifiedUserContext(userId: string | undefined): Promise<UnifiedUserContext | null> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return null
  }

  const normalizedUserId = userId.trim()

  try {
    // Load both in parallel for efficiency
    const [userMemory, overviewSections] = await Promise.all([
      reconstructMemory(normalizedUserId),
      readOverviewSections(normalizedUserId),
    ])

    // Extract current focus from overview
    let currentFocus: string | undefined
    if (overviewSections?.['current_focus v1']) {
      currentFocus = overviewSections['current_focus v1'].text.trim()
    }

    // Extract recent changes from change log
    let recentChanges: string[] = []
    if (overviewSections?.['change_log v1']) {
      recentChanges = filterRecent7Days(overviewSections['change_log v1'].text)
    }

    return {
      userMemory,
      currentFocus,
      recentChanges,
    }
  } catch (error) {
    console.error('[UnifiedLoader] Failed to load unified context', {
      userId: normalizedUserId,
      error,
    })
    return null
  }
}
