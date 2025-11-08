import { reconstructMemory } from './service'
import type { UserMemory } from './types'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UnifiedUserContext {
  userMemory: UserMemory
  currentFocus?: string
  recentChanges: Array<{
    timestamp: string
    eventType: string
    description: string
  }>
}

/**
 * Load unified user context combining UserMemory and DB context views.
 * 
 * **DB-Only Context**: Replaced markdown reads with queries to:
 * - user_context_cache: Recent parts, follow-ups, session summary
 * - timeline_display: Recent events and changes for the last 7 days
 * 
 * Returns null if userId is invalid or data cannot be loaded.
 */
export async function loadUnifiedUserContext(userId: string | undefined): Promise<UnifiedUserContext | null> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return null
  }

  const normalizedUserId = userId.trim()

  try {
    const supabase = createAdminClient()

    // Load both in parallel for efficiency
    const [userMemory, contextCache, recentTimeline] = await Promise.all([
      reconstructMemory(normalizedUserId),
      loadUserContextCache(supabase, normalizedUserId),
      loadRecentTimelineEvents(supabase, normalizedUserId),
    ])

    // Extract current focus from recent parts or session
    let currentFocus: string | undefined
    if (contextCache?.last_session?.next_session) {
      currentFocus = `Next Session: ${contextCache.last_session.next_session}`
    } else if (contextCache?.recent_parts && contextCache.recent_parts.length > 0) {
      const focusedParts = contextCache.recent_parts
        .filter((p) => p.needs_attention)
        .slice(0, 2)
        .map((p) => p.display_name)
      if (focusedParts.length > 0) {
        currentFocus = `Parts needing attention: ${focusedParts.join(', ')}`
      }
    }

    // Extract recent changes from timeline display (last 7 days)
    const recentChanges = recentTimeline

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

interface ContextCache {
  last_session?: {
    next_session?: string
  }
  recent_parts?: Array<{
    display_name?: string
    needs_attention?: boolean
  }>
}

/**
 * Load user context cache materialized view.
 * Contains recent parts, follow-ups, and session summary.
 */
async function loadUserContextCache(supabase: ReturnType<typeof createAdminClient>, userId: string): Promise<ContextCache | null> {
  const { data, error } = await supabase
    .from('user_context_cache')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.warn('[UnifiedLoader] Failed to load user_context_cache', { userId, error: error.message })
    return null
  }

  return data as ContextCache | null
}

/**
 * Load recent timeline events from the last 7 days.
 * Converts to simple change format for context.
 */
async function loadRecentTimelineEvents(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<Array<{ timestamp: string; eventType: string; description: string }>> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data, error } = await supabase
    .from('timeline_display')
    .select('created_at, event_type, event_subtype, description')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    console.warn('[UnifiedLoader] Failed to load timeline_display', { userId, error: error.message })
    return []
  }

  // Convert timeline events to simple change format
  return (data || []).map((event: { created_at: string; event_type: string; event_subtype: string; description?: string }) => ({
    timestamp: event.created_at,
    eventType: event.event_type,
    description: event.description || `${event.event_type}: ${event.event_subtype}`,
  }))
}
