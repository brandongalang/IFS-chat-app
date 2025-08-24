import { createTool } from '@mastra/core'
import { createServerClient } from '@supabase/ssr'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { actionLogger } from '../../lib/database/action-logger'
import { resolveUserId, requiresUserConfirmation, devLog, developmentConfig } from '../config/development'
import type { Database, PartRow, PartEvidence, PartUpdate, ToolResult } from '../../lib/types/database'

// Input schemas for evidence tool validation
const logEvidenceSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to add evidence to'),
  evidence: z.object({
    type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']).describe('Type of evidence'),
    content: z.string().min(1).describe('Content of the evidence'),
    confidence: z.number().min(0).max(1).describe('Confidence score for this evidence'),
    sessionId: z.string().uuid().describe('Session ID where evidence was observed'),
    timestamp: z.string().datetime().describe('Timestamp when evidence was observed')
  }).describe('Evidence to add'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)')
})

const findPatternsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID to analyze patterns for (optional in development mode)'),
  sessionLimit: z.number().min(1).max(50).default(10).describe('Number of recent sessions to analyze'),
  minConfidence: z.number().min(0).max(1).default(0.3).describe('Minimum confidence threshold for patterns'),
  includeExistingParts: z.boolean().default(false).describe('Whether to include patterns for already discovered parts')
})

// Create Supabase client based on environment
const createSupabaseClient = () => {
  if (typeof window !== 'undefined') {
    // Browser environment
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  } else {
    // Server environment
    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {},
        },
      }
    )
  }
}

/**
 * Log evidence for a specific part
 */
const logEvidence = createTool({
  id: 'logEvidence',
  description: 'Add evidence to a part\'s recent evidence array, maintaining the limit of 10 most recent items',
  inputSchema: logEvidenceSchema,
  execute: async ({ partId, evidence, userId }): Promise<ToolResult> => {
    try {
      const resolvedUserId = await resolveUserId(userId)
      const supabase = createSupabaseClient()

      devLog('logEvidence called', { partId, evidenceType: evidence.type, userId: resolvedUserId })

      // Get current part data
      const { data: currentPart, error: fetchError } = await supabase
        .from('parts')
        .select('id, name, user_id, recent_evidence, evidence_count')
        .eq('id', partId)
        .eq('user_id', resolvedUserId)
        .single()

      if (fetchError) {
        return { success: false, error: `Failed to fetch part: ${fetchError.message}` }
      }

      if (!currentPart) {
        return { success: false, error: 'Part not found or access denied' }
      }

      // Add new evidence to recent evidence array, keep only last 10
      const currentEvidence = currentPart.recent_evidence || []
      const newEvidenceArray = [...currentEvidence, evidence].slice(-10)
      const newEvidenceCount = currentPart.evidence_count + 1

      // Update the part with new evidence
      const { data: updatedPart, error: updateError } = await supabase
        .from('parts')
        .update({
          recent_evidence: newEvidenceArray,
          evidence_count: newEvidenceCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', partId)
        .eq('user_id', resolvedUserId)
        .select()
        .single()

      if (updateError) {
        return { success: false, error: `Failed to update part with evidence: ${updateError.message}` }
      }

      // Log the action for rollback capability
      await actionLogger.log({
        actionType: 'add_part_evidence',
        partId,
        partName: currentPart.name,
        userId: resolvedUserId,
        sessionId: evidence.sessionId,
        currentState: `Evidence count: ${newEvidenceCount}`,
        changeDescription: `Added ${evidence.type} evidence: "${evidence.content.substring(0, 100)}..."`,
        evidenceAdded: true,
        metadata: {
          evidenceType: evidence.type,
          confidence: evidence.confidence,
          previousCount: currentPart.evidence_count
        }
      })

      return {
        success: true,
        data: {
          partId: updatedPart.id,
          partName: updatedPart.name,
          evidenceCount: newEvidenceCount,
          evidenceAdded: true
        },
        message: `Evidence added to "${currentPart.name}". Total evidence count: ${newEvidenceCount}`
      }

    } catch (error) {
      devLog('Error in logEvidence', { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: `Unexpected error logging evidence: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
})

/**
 * Find patterns in conversation history
 */
const findPatterns = createTool({
  id: 'findPatterns',
  description: 'Analyze conversation history to find recurring themes and suggest potential new parts based on frequency and recency',
  inputSchema: findPatternsSchema,
  execute: async ({ userId, sessionLimit, minConfidence, includeExistingParts }): Promise<ToolResult> => {
    try {
      const resolvedUserId = await resolveUserId(userId)
      const supabase = createSupabaseClient()

      devLog('findPatterns called', { 
        userId: resolvedUserId, 
        sessionLimit, 
        minConfidence, 
        includeExistingParts 
      })

      // Get recent sessions for the user
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, messages')
        .eq('user_id', resolvedUserId)
        .order('created_at', { ascending: false })
        .limit(sessionLimit)

      if (sessionsError) {
        return { success: false, error: `Failed to fetch sessions: ${sessionsError.message}` }
      }

      if (!sessions || sessions.length === 0) {
        return { 
          success: true, 
          data: { patterns: [], suggestedParts: [] },
          message: 'No conversation history found'
        }
      }

      // Get existing parts if we should exclude them
      let existingParts: PartRow[] = []
      if (!includeExistingParts) {
        const { data: parts, error: partsError } = await supabase
          .from('parts')
          .select('name, role')
          .eq('user_id', resolvedUserId)

        if (partsError) {
          return { success: false, error: `Failed to fetch existing parts: ${partsError.message}` }
        }

        existingParts = parts || []
      }

      // Analyze patterns in conversation messages
      const patterns = new Map<string, {
        theme: string,
        frequency: number,
        confidence: number,
        sessions: string[],
        examples: string[]
      }>()

      // Pattern keywords and phrases that suggest parts
      const partIndicators = [
        { pattern: /part of me (that|who) ([^.!?]+)/gi, type: 'direct_mention', weight: 0.9 },
        { pattern: /there's a (part|voice|side) of me/gi, type: 'direct_mention', weight: 0.8 },
        { pattern: /i have this (inner|internal) ([^.!?]+)/gi, type: 'pattern', weight: 0.7 },
        { pattern: /i always ([^.!?]+) when/gi, type: 'behavior', weight: 0.6 },
        { pattern: /whenever i ([^.!?]+), i feel/gi, type: 'emotion', weight: 0.6 },
        { pattern: /my (inner|internal) ([^.!?]+)/gi, type: 'pattern', weight: 0.5 },
      ]

      // Analyze each session's messages
      for (const session of sessions) {
        const messages = Array.isArray(session.messages) ? session.messages : []
        
        for (const message of messages) {
          if (message.role === 'user') {
            const content = message.content.toLowerCase()
            
            // Look for part-indicating patterns
            for (const indicator of partIndicators) {
              const matches = content.match(indicator.pattern)
              if (matches) {
                for (const match of matches) {
                  const patternKey = match.trim()
                  const existing = patterns.get(patternKey)
                  
                  if (existing) {
                    existing.frequency += 1
                    existing.confidence = Math.min(existing.confidence + indicator.weight * 0.1, 1)
                    if (!existing.sessions.includes(session.id)) {
                      existing.sessions.push(session.id)
                    }
                    if (existing.examples.length < 3) {
                      existing.examples.push(match)
                    }
                  } else {
                    patterns.set(patternKey, {
                      theme: patternKey,
                      frequency: 1,
                      confidence: indicator.weight,
                      sessions: [session.id],
                      examples: [match]
                    })
                  }
                }
              }
            }
          }
        }
      }

      // Filter patterns by confidence threshold and check against existing parts
      const filteredPatterns = Array.from(patterns.values())
        .filter(pattern => pattern.confidence >= minConfidence)
        .filter(pattern => {
          if (includeExistingParts) return true
          
          // Check if pattern is similar to existing parts
          const patternText = pattern.theme.toLowerCase()
          return !existingParts.some(part => 
            patternText.includes(part.name.toLowerCase()) ||
            (part.role && patternText.includes(part.role.toLowerCase()))
          )
        })
        .sort((a, b) => b.confidence - a.confidence)

      // Generate suggested parts from high-confidence patterns
      const suggestedParts = filteredPatterns
        .slice(0, 3) // Top 3 suggestions
        .filter(pattern => pattern.confidence > 0.7 && pattern.frequency > 1)
        .map(pattern => ({
          suggestedName: pattern.theme.replace(/part of me (that|who) /gi, '').trim(),
          confidence: pattern.confidence,
          frequency: pattern.frequency,
          evidence: pattern.examples.map(example => ({
            type: 'pattern' as const,
            content: example,
            confidence: pattern.confidence,
            sessionIds: pattern.sessions
          })),
          reasoning: `Pattern detected across ${pattern.sessions.length} sessions with ${pattern.frequency} occurrences`
        }))

      return {
        success: true,
        data: {
          patterns: filteredPatterns,
          suggestedParts,
          sessionsAnalyzed: sessions.length,
          existingPartsCount: existingParts.length
        },
        message: `Found ${filteredPatterns.length} patterns across ${sessions.length} sessions. ${suggestedParts.length} parts suggested.`
      }

    } catch (error) {
      devLog('Error in findPatterns', { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: `Unexpected error finding patterns: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
})

// Export tools object
export const evidenceTools = {
  logEvidence,
  findPatterns
}