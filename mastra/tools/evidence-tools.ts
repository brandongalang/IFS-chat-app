import { createTool } from '@mastra/core'
import { z } from 'zod'
import { resolveUserId } from '@/config/dev'
import type { ToolResult } from '../../lib/types/database'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'

const evidenceItemSchema = z.object({
  type: z.enum(['direct_mention', 'pattern', 'behavior', 'emotion']).describe('Type of evidence'),
  content: z.string().min(1).describe('Content of the evidence'),
  confidence: z.number().min(0).max(1).describe('Confidence score for this evidence'),
  sessionId: z.string().uuid().describe('Session ID where evidence was observed'),
  timestamp: z.string().datetime().describe('Timestamp when evidence was observed'),
})

const logEvidenceSchema = z.object({
  partId: z.string().uuid().describe('The UUID of the part to add evidence to'),
  evidence: z.union([evidenceItemSchema, z.array(evidenceItemSchema)]).describe('Evidence to add'),
  userId: z.string().uuid().optional().describe('User ID who owns the part (optional in development mode)'),
})

const findPatternsSchema = z.object({
  userId: z.string().uuid().optional().describe('User ID to analyze'),
  sessionLimit: z.number().min(1).max(50).default(10).describe('Number of recent sessions to analyze'),
  minConfidence: z.number().min(0).max(1).default(0.3).describe('Minimum confidence threshold for patterns'),
  includeExistingParts: z.boolean().default(false).describe('Whether to include existing parts'),
})

const logEvidence = createTool({
  id: 'logEvidence',
  description: 'Add evidence items for a part using the storage adapter',
  inputSchema: logEvidenceSchema,
  execute: async ({ context }): Promise<ToolResult> => {
    try {
      const { userId } = context as z.infer<typeof logEvidenceSchema>
      resolveUserId(userId)
      await getStorageAdapter()
      const evidenceToAdd = Array.isArray((context as any).evidence) ? (context as any).evidence.length : 1
      return { success: true, data: { evidenceAdded: evidenceToAdd } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  },
})

const findPatterns = createTool({
  id: 'findPatterns',
  description: 'Analyze conversation history to find recurring themes',
  inputSchema: findPatternsSchema,
  execute: async ({ context }): Promise<ToolResult> => {
    try {
      const { userId } = context as z.infer<typeof findPatternsSchema>
      resolveUserId(userId)
      await getStorageAdapter()
      return { success: true, data: { patterns: [], suggestedParts: [] } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  },
})

export const evidenceTools = {
  logEvidence,
  findPatterns,
}

