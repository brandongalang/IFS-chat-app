/**
 * Inbox-to-Chat Bridge Module
 * 
 * Handles context passing from inbox observations to chat sessions.
 * Uses sessionStorage for client-side context persistence during navigation.
 */

import type { InboxEnvelope, InsightSpotlightEnvelope, NudgeEnvelope } from '@/types/inbox'

const CONTEXT_STORAGE_KEY = 'inbox_chat_context'
const CONTEXT_TTL_MS = 10 * 60 * 1000 // 10 minutes

export type InboxChatReaction = 'confirmed' | 'denied'

export interface InboxChatContext {
  systemInstruction: string
  metadata: {
    observationId: string
    reaction: InboxChatReaction
    observation: InboxEnvelope
  }
  timestamp: number
}

/**
 * Generate a system instruction for the chat agent based on user's reaction to an observation.
 * 
 * @param observation - The inbox envelope the user reacted to
 * @param reaction - Whether user confirmed or denied the observation
 * @returns System instruction string for the agent
 */
export function generateSystemInstruction(
  observation: InboxEnvelope,
  reaction: InboxChatReaction
): string {
  // Extract content based on observation type
  let content: string
  let partName: string | undefined
  let evidence: string[] | undefined

  if (observation.type === 'insight_spotlight') {
    const insight = observation as InsightSpotlightEnvelope
    content = insight.payload.summary
    partName = insight.metadata?.partName as string | undefined
    evidence = insight.payload.evidence?.map(e => e.summary || e.quote || 'Evidence item').filter(Boolean)
  } else if (observation.type === 'nudge') {
    const nudge = observation as NudgeEnvelope
    content = nudge.payload.headline + (nudge.payload.body ? `\n\n${nudge.payload.body}` : '')
  } else {
    content = observation.metadata?.content as string || 'the observation'
  }

  if (reaction === 'confirmed') {
    const parts = [
      `The user just reviewed and CONFIRMED the following observation from their inbox:`,
      ``,
      `"${content}"`,
      ``,
      `They clicked "Explore in chat" indicating they want to discuss this pattern further.`,
    ]

    if (partName) {
      parts.push(``, `Part involved: ${partName}`)
    }

    if (evidence && evidence.length > 0) {
      parts.push(``, `Evidence: ${evidence.join(', ')}`)
    }

    parts.push(
      ``,
      `Start by acknowledging their confirmation and explore what might be happening with this pattern. Be curious about the deeper dynamics at play. Reference specific details from the observation.`
    )

    return parts.join('\n')
  } else {
    const parts = [
      `The user just reviewed and DISAGREED with the following observation from their inbox:`,
      ``,
      `"${content}"`,
      ``,
      `They clicked "Tell me what really happened" indicating the observation wasn't accurate.`,
      ``,
      `Start by thanking them for the correction and explore what was actually happening for them. Be curious and non-defensive about getting it right. This is a learning opportunity.`,
    ]

    return parts.join('\n')
  }
}

/**
 * Package observation and reaction into a chat context object.
 * 
 * @param observation - The inbox envelope
 * @param reaction - User's reaction (confirmed/denied)
 * @returns Chat context object ready for storage
 */
export function packChatContext(
  observation: InboxEnvelope,
  reaction: InboxChatReaction
): InboxChatContext {
  return {
    systemInstruction: generateSystemInstruction(observation, reaction),
    metadata: {
      observationId: observation.sourceId,
      reaction,
      observation,
    },
    timestamp: Date.now(),
  }
}

/**
 * Save chat context to sessionStorage.
 * 
 * @param context - The context to save
 */
export function saveContextToSession(context: InboxChatContext): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      console.warn('[chat-bridge] sessionStorage not available')
      return
    }

    sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context))
  } catch (error) {
    console.error('[chat-bridge] Failed to save context to session:', error)
  }
}

/**
 * Read and clear chat context from sessionStorage.
 * Validates that context hasn't expired (TTL check).
 * 
 * @returns The stored context if valid, null otherwise
 */
export function readAndClearContextFromSession(): InboxChatContext | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null
    }

    const raw = sessionStorage.getItem(CONTEXT_STORAGE_KEY)
    if (!raw) {
      return null
    }

    // Clear immediately after reading to ensure one-time consumption
    sessionStorage.removeItem(CONTEXT_STORAGE_KEY)

    const context = JSON.parse(raw) as InboxChatContext

    // Validate structure
    if (!context.systemInstruction || !context.metadata || !context.timestamp) {
      console.warn('[chat-bridge] Invalid context structure')
      return null
    }

    // Check TTL
    const age = Date.now() - context.timestamp
    if (age > CONTEXT_TTL_MS) {
      console.warn('[chat-bridge] Context expired (age:', Math.round(age / 1000), 'seconds)')
      return null
    }

    return context
  } catch (error) {
    console.error('[chat-bridge] Failed to read context from session:', error)
    return null
  }
}

/**
 * Clear any stored context without reading it.
 * Useful for cleanup or error handling.
 */
export function clearStoredContext(): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return
    }

    sessionStorage.removeItem(CONTEXT_STORAGE_KEY)
  } catch (error) {
    console.error('[chat-bridge] Failed to clear context:', error)
  }
}
