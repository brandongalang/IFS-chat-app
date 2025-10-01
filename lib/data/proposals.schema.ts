import { z } from 'zod'

const splitChildSchema = z
  .object({
    name: z.string().min(1).max(100),
    role: z.string().optional(),
    age: z.number().min(0).max(100).optional(),
    evidenceIds: z.array(z.string()).optional().default([]),
  })
  .strict()

export const proposePartSplitSchema = z
  .object({
    parentPartId: z.string().uuid(),
    children: z.array(splitChildSchema).min(2),
    rationale: z.string().min(3).max(2000),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict()

export const proposePartMergeSchema = z
  .object({
    partIds: z.array(z.string().uuid()).min(2),
    canonicalName: z.string().min(1).max(100),
    rationale: z.string().min(3).max(2000),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict()

export const approveRejectSchema = z
  .object({
    proposalId: z.string().uuid(),
    approvedBy: z.string().min(1),
  })
  .strict()

export const executeProposalSchema = z
  .object({
    proposalId: z.string().uuid(),
  })
  .strict()

export type ProposePartSplitInput = z.infer<typeof proposePartSplitSchema>
export type ProposePartMergeInput = z.infer<typeof proposePartMergeSchema>
export type ApproveRejectInput = z.infer<typeof approveRejectSchema>
export type ExecuteProposalInput = z.infer<typeof executeProposalSchema>
