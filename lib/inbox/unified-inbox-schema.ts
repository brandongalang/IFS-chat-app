/**
 * Unified Inbox Schema
 * 
 * Supports all 6 inbox item types with a single flexible schema.
 * Maps to inbox_items table in the database.
 */

import { z } from 'zod'

/**
 * Evidence reference for observations and patterns.
 * Structured as {type, id, context} for traceability.
 */
export const unifiedEvidenceSchema = z
  .object({
    type: z.enum(['session', 'part', 'observation', 'checkin', 'relationship']),
    id: z.string().uuid(),
    context: z.string().max(200).optional(),
  })
  .strict()

/**
 * Single inbox item candidate (before insertion).
 * Supports all 6 output types with optional fields for type-specific content.
 */
export const unifiedInboxItemCandidateSchema = z
  .object({
    // Classification
    type: z.enum(
      ['session_summary', 'nudge', 'follow_up', 'observation', 'question', 'pattern'],
      {
        description: '6 output types supported by unified inbox',
      }
    ),

    // Universal fields (all types have these)
    title: z.string().min(4).max(140).describe('Short, engaging title'),
    summary: z.string().min(10).max(400).describe('Main content summary'),

    // Type-specific content
    body: z
      .string()
      .max(500)
      .optional()
      .describe('Extended body text (for nudge, follow_up)'),
    inference: z
      .string()
      .max(500)
      .optional()
      .describe('Therapeutic hypothesis (for observation, question)'),

    // Evidence & References (for observations, patterns)
    evidence: z.array(unifiedEvidenceSchema).max(10).optional().describe('Evidence references'),
    relatedPartIds: z
      .array(z.string().uuid())
      .max(8)
      .optional()
      .describe('Parts involved'),
    sourceSessionIds: z
      .array(z.string().uuid())
      .max(10)
      .optional()
      .describe('Sessions that informed this item'),

    // Quality metrics
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Confidence score (0-1) for ML-generated items'),

    // Flexible metadata
    metadata: z.record(z.unknown()).optional().describe('Type-specific metadata'),
  })
  .strict()

/**
 * Batch of inbox items from the unified agent.
 * Agent returns this format; engine parses and inserts into DB.
 */
export const unifiedInboxBatchSchema = z
  .object({
    items: z
      .array(unifiedInboxItemCandidateSchema)
      .max(6)
      .describe('Up to 6 items per batch'),
    notes: z.string().optional().describe('Agent notes or rationale'),
  })
  .strict()

// ============================================================================
// Exported Types
// ============================================================================

export type UnifiedEvidence = z.infer<typeof unifiedEvidenceSchema>
export type UnifiedInboxItemCandidate = z.infer<typeof unifiedInboxItemCandidateSchema>
export type UnifiedInboxBatch = z.infer<typeof unifiedInboxBatchSchema>

// Type guard
export function isUnifiedInboxBatch(value: unknown): value is UnifiedInboxBatch {
  return unifiedInboxBatchSchema.safeParse(value).success
}

// ============================================================================
// Type-specific content builders
// ============================================================================

/**
 * Build content JSONB for inbox_items.content column.
 * Includes only relevant fields for each type.
 */
export function buildUnifiedItemContent(item: UnifiedInboxItemCandidate): Record<string, unknown> {
  const base = {
    title: item.title,
    summary: item.summary,
  }

  switch (item.type) {
    case 'session_summary':
      return {
        ...base,
        type: 'session_summary',
      }

    case 'nudge':
      return {
        ...base,
        type: 'nudge',
        body: item.body,
      }

    case 'follow_up':
      return {
        ...base,
        type: 'follow_up',
        body: item.body,
      }

    case 'observation':
      return {
        ...base,
        type: 'observation',
        inference: item.inference,
        evidence: item.evidence ?? [],
      }

    case 'question':
      return {
        ...base,
        type: 'question',
        inference: item.inference,
      }

    case 'pattern':
      return {
        ...base,
        type: 'pattern',
        inference: item.inference,
        evidence: item.evidence ?? [],
      }

    default:
      const _exhaustive: never = item.type
      return _exhaustive
  }
}

/**
 * Build metadata JSONB for inbox_items.metadata column.
 * Includes type-agnostic provenance and optional type-specific fields.
 */
export function buildUnifiedItemMetadata(
  item: UnifiedInboxItemCandidate,
  additional?: Record<string, unknown>
): Record<string, unknown> {
  return {
    kind: 'unified_inbox_item',
    type: item.type,
    confidence: item.confidence ?? null,
    ...(item.metadata ?? {}),
    ...(additional ?? {}),
  }
}
