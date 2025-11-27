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
 * Action button schema for flexible agent-generated response options.
 * UI adapts layout automatically based on button count and label lengths.
 */
export const inboxActionButtonSchema = z.object({
  value: z.string().min(1).max(50).describe('Stored value when user selects this option'),
  label: z.string().min(1).max(80).describe('Display text for the button'),
  shortLabel: z.string().max(20).optional().describe('Abbreviated label for compact layouts'),
  emoji: z.string().max(4).optional().describe('Optional emoji prefix'),
  variant: z.enum(['primary', 'secondary', 'ghost']).optional().describe('Button styling hint'),
})

/**
 * Flexible action schema that lets the agent define response options.
 * The UI automatically adapts layout based on content.
 */
export const inboxActionSchema = z.object({
  buttons: z.array(inboxActionButtonSchema).max(6).describe('Response buttons'),
  allowFreeText: z.boolean().optional().describe('Show textarea for open response'),
  freeTextPlaceholder: z.string().max(100).optional().describe('Placeholder for free text input'),
  helperText: z.string().max(150).optional().describe('Guidance text below buttons'),
})

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

    // Response actions - agent specifies how user can respond
    actions: inboxActionSchema.optional().describe('Response options for the user'),

    // Flexible metadata
    metadata: z.record(z.unknown()).optional().describe('Type-specific metadata'),
  })

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
export type InboxActionButton = z.infer<typeof inboxActionButtonSchema>
export type InboxAction = z.infer<typeof inboxActionSchema>

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
    // Store agent-specified actions in metadata for envelope builder
    ...(item.actions ? { actions: item.actions } : {}),
    ...(item.metadata ?? {}),
    ...(additional ?? {}),
  }
}
