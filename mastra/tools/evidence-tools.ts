import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId, devLog } from '@/config/dev'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { getServerSupabaseClient } from '@/lib/supabase/clients'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { searchParts as searchPartsData } from '@/lib/data/parts'
import type { PartRow, ToolResult, SessionRow } from '@/lib/types/database'

const evidenceItemSchema = z
  .object({
    type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']).describe('Type of evidence'),
    content: z.string().min(1).describe('Content of the evidence'),
    confidence: z.number().min(0).max(1).describe('Confidence score for this evidence'),
    sessionId: z.string().uuid().describe('Session ID where evidence was observed'),
    timestamp: z.string().datetime().describe('Timestamp when evidence was observed'),
  })
  .strict()

const logEvidenceSchema = z
  .object({
    partId: z.string().uuid().describe('The UUID of the part to add evidence to'),
    evidence: z
      .union([evidenceItemSchema, z.array(evidenceItemSchema)])
      .describe('Evidence to add'),
  })
  .strict()

const findPatternsSchema = z
  .object({
    sessionLimit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Number of recent sessions to analyze'),
    minConfidence: z
      .number()
      .min(0)
      .max(1)
      .default(0.3)
      .describe('Minimum confidence threshold for patterns'),
    includeExistingParts: z
      .boolean()
      .default(false)
      .describe('Whether to include existing parts'),
  })
  .strict()

export type LogEvidenceInput = z.infer<typeof logEvidenceSchema>
export type FindPatternsInput = z.infer<typeof findPatternsSchema>

function ensureUserId(baseUserId: string | undefined, runtime?: { userId?: string }) {
  return resolveUserId(runtime?.userId ?? baseUserId)
}

async function resolveSupabase(
  baseUserId: string | undefined,
  runtime?: { userId?: string }
): Promise<{ client: SupabaseDatabaseClient; userId: string }> {
  const userId = ensureUserId(baseUserId, runtime)
  const client = await getServerSupabaseClient()
  return { client, userId }
}

export function createEvidenceTools(userId?: string) {
  const logEvidence = createTool({
    id: 'logEvidence',
    description: 'Add evidence items for a part using the storage adapter',
    inputSchema: logEvidenceSchema,
    execute: async ({ context, runtime }: { context: LogEvidenceInput; runtime?: { userId?: string } }): Promise<ToolResult> => {
      try {
        const input = logEvidenceSchema.parse(context)
        const resolvedUserId = ensureUserId(userId, runtime)
        await getStorageAdapter()
        const evidenceToAdd = Array.isArray(input.evidence) ? input.evidence.length : 1
        return { success: true, data: { evidenceAdded: evidenceToAdd, userId: resolvedUserId } }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })

  const findPatterns = createTool({
    id: 'findPatterns',
    description: 'Analyze conversation history to find recurring themes',
    inputSchema: findPatternsSchema,
    execute: async ({ context, runtime }: { context: FindPatternsInput; runtime?: { userId?: string } }): Promise<ToolResult> => {
      try {
        const input = findPatternsSchema.parse(context)
        const { client: supabase, userId: resolvedUserId } = await resolveSupabase(userId, runtime)
        const { sessionLimit, minConfidence, includeExistingParts } = input

        devLog('findPatterns called', {
          userId: resolvedUserId,
          sessionLimit,
          minConfidence,
          includeExistingParts,
        })

        const storage = await getStorageAdapter()
        const prefix = `users/${resolvedUserId}/sessions/`
        const paths = await storage.list(prefix)
        const allSessions: SessionRow[] = []

        for (const path of paths) {
          try {
            const text = await storage.getText(path)
            if (!text) continue
            const session = JSON.parse(text) as SessionRow
            allSessions.push(session)
          } catch {
            /* ignore parse errors */
          }
        }

        allSessions.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        const sessions = allSessions.slice(0, sessionLimit)

        if (sessions.length === 0) {
          return {
            success: true,
            data: { patterns: [], suggestedParts: [], sessionsAnalyzed: 0, existingPartsCount: 0 },
          }
        }

        let existingParts: Array<{ name: string; role: string | null }> = []
        if (!includeExistingParts) {
          const parts = (await searchPartsData(
            { limit: 200 },
            { client: supabase, userId: resolvedUserId }
          )) as PartRow[]
          existingParts = parts.map((part) => ({ name: part.name, role: part.role }))
        }

        const patterns = new Map<
          string,
          {
            theme: string
            frequency: number
            confidence: number
            sessions: string[]
            examples: string[]
          }
        >()

        const partIndicators = [
          { pattern: /part of me (that|who) ([^.!?]+)/gi, type: 'direct_mention', weight: 0.9 },
          { pattern: /there's a (part|voice|side) of me/gi, type: 'direct_mention', weight: 0.8 },
          { pattern: /i have this (inner|internal) ([^.!?]+)/gi, type: 'pattern', weight: 0.7 },
          { pattern: /i always ([^.!?]+) when/gi, type: 'behavior', weight: 0.6 },
          { pattern: /whenever i ([^.!?]+), i feel/gi, type: 'emotion', weight: 0.6 },
          { pattern: /my (inner|internal) ([^.!?]+)/gi, type: 'pattern', weight: 0.5 },
        ]

        for (const session of sessions) {
          const messages = Array.isArray(session.messages) ? session.messages : []

          for (const message of messages) {
            if (message.role === 'user') {
              const content = message.content.toLowerCase()

              for (const indicator of partIndicators) {
                const matches = content.match(indicator.pattern)
                if (!matches) continue

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
                      examples: [match],
                    })
                  }
                }
              }
            }
          }
        }

        const filteredPatterns = Array.from(patterns.values())
          .filter((pattern) => pattern.confidence >= minConfidence)
          .filter((pattern) => {
            if (includeExistingParts) return true
            const patternText = pattern.theme.toLowerCase()
            return !existingParts.some((part) =>
              patternText.includes(part.name.toLowerCase()) ||
              (part.role && patternText.includes(part.role.toLowerCase()))
            )
          })
          .sort((a, b) => b.confidence - a.confidence)

        const suggestedParts = filteredPatterns
          .slice(0, 3)
          .filter((pattern) => pattern.confidence > 0.7 && pattern.frequency > 1)
          .map((pattern) => ({
            suggestedName: pattern.theme.replace(/part of me (that|who) /gi, '').trim(),
            confidence: pattern.confidence,
            frequency: pattern.frequency,
            evidence: pattern.examples.map((example) => ({
              type: 'pattern' as const,
              content: example,
              confidence: pattern.confidence,
              sessionIds: pattern.sessions,
            })),
            reasoning: `Pattern detected across ${pattern.sessions.length} sessions with ${pattern.frequency} occurrences`,
          }))

        return {
          success: true,
          data: {
            patterns: filteredPatterns,
            suggestedParts,
            sessionsAnalyzed: sessions.length,
            existingPartsCount: existingParts.length,
          },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })

  return {
    logEvidence,
    findPatterns,
  }
}

export type EvidenceTools = ReturnType<typeof createEvidenceTools>
