/**
 * @deprecated Use `unified-inbox-schema.ts` instead.
 * This schema is kept for backward compatibility with the observation-engine.
 * All new code should use UnifiedInboxBatch and related schemas.
 */

import { z } from 'zod'

const dateTimeSchema = z
  .string()
  .trim()
  .refine((value) => {
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp)
  }, 'Expected ISO 8601 timestamp')

export const observationEvidenceSchema = z
  .object({
    type: z.string().min(1).max(64),
    summary: z.string().min(1).max(400).optional(),
    sessionId: z.string().uuid().optional(),
    checkInId: z.string().uuid().optional(),
    source: z.string().max(160).optional(),
    quote: z.string().max(600).optional(),
    occurredAt: dateTimeSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

export const observationRelatedPartSchema = z
  .object({
    partId: z.string().uuid(),
    relationship: z.string().max(160).optional(),
  })
  .strict()

export const observationCandidateSchema = z
  .object({
    title: z.string().min(4).max(140),
    summary: z.string().min(10).max(400),
    inference: z.string().min(10).max(600),
    rationale: z.string().max(600).optional(),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional(),
    timeframe: z
      .object({
        start: dateTimeSchema.nullable().optional(),
        end: dateTimeSchema.nullable().optional(),
      })
      .partial()
      .optional(),
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    relatedParts: z.array(observationRelatedPartSchema).max(8).optional(),
    evidence: z.array(observationEvidenceSchema).max(10).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

export const observationBatchSchema = z
  .object({
    observations: z.array(observationCandidateSchema).max(3),
    notes: z.string().optional(),
  })
  .strict()

export type ObservationEvidence = z.infer<typeof observationEvidenceSchema>
export type ObservationRelatedPart = z.infer<typeof observationRelatedPartSchema>
export type ObservationCandidate = z.infer<typeof observationCandidateSchema>
export type ObservationBatch = z.infer<typeof observationBatchSchema>
