import { createTool } from '@mastra/core'
import { resolveUserId } from '@/config/dev'
import { getServerSupabaseClient } from '@/lib/supabase/clients'
import {
  proposePartSplitSchema,
  proposePartMergeSchema,
  approveRejectSchema,
  executeProposalSchema,
  type ProposePartSplitInput,
  type ProposePartMergeInput,
  type ApproveRejectInput,
  type ExecuteProposalInput,
} from '@/lib/data/proposals.schema'
import {
  proposePartSplit as proposePartSplitData,
  proposePartMerge as proposePartMergeData,
  approveProposal as approveProposalData,
  rejectProposal as rejectProposalData,
  executeSplit as executeSplitData,
  executeMerge as executeMergeData,
} from '@/lib/data/proposals'

async function resolveDependencies(
  baseUserId: string | undefined,
  runtime?: { userId?: string }
) {
  const userId = resolveUserId(runtime?.userId ?? baseUserId)
  const client = await getServerSupabaseClient()
  return { client, userId }
}

export function createProposalTools(userId?: string) {
  const proposePartSplitTool = createTool({
    id: 'proposePartSplit',
    description: 'Create a proposal to split a parent part into multiple child parts. No data is mutated until approval.',
    inputSchema: proposePartSplitSchema,
    execute: async ({ context, runtime }: { context: ProposePartSplitInput; runtime?: { userId?: string } }) => {
      const deps = await resolveDependencies(userId, runtime)
      const result = await proposePartSplitData(context, deps)
      return result
    },
  })

  const proposePartMergeTool = createTool({
    id: 'proposePartMerge',
    description: 'Create a proposal to merge multiple parts into a canonical part. No data is mutated until approval.',
    inputSchema: proposePartMergeSchema,
    execute: async ({ context, runtime }: { context: ProposePartMergeInput; runtime?: { userId?: string } }) => {
      const deps = await resolveDependencies(userId, runtime)
      const result = await proposePartMergeData(context, deps)
      return result
    },
  })

  const approveProposalTool = createTool({
    id: 'approveProposal',
    description: 'Approve a pending proposal (split or merge). Does not execute the mutation yet.',
    inputSchema: approveRejectSchema,
    execute: async ({ context, runtime }: { context: ApproveRejectInput; runtime?: { userId?: string } }) => {
      const deps = await resolveDependencies(userId, runtime)
      const result = await approveProposalData(context, deps)
      return result
    },
  })

  const rejectProposalTool = createTool({
    id: 'rejectProposal',
    description: 'Reject a pending proposal (split or merge).',
    inputSchema: approveRejectSchema,
    execute: async ({ context, runtime }: { context: ApproveRejectInput; runtime?: { userId?: string } }) => {
      const deps = await resolveDependencies(userId, runtime)
      const result = await rejectProposalData(context, deps)
      return result
    },
  })

  const executeSplitTool = createTool({
    id: 'executeSplit',
    description: 'Execute an approved split proposal. Mutates data and updates lineage.',
    inputSchema: executeProposalSchema,
    execute: async ({ context, runtime }: { context: ExecuteProposalInput; runtime?: { userId?: string } }) => {
      const deps = await resolveDependencies(userId, runtime)
      const result = await executeSplitData(context, deps)
      return result
    },
  })

  const executeMergeTool = createTool({
    id: 'executeMerge',
    description: 'Execute an approved merge proposal. Mutates data and updates lineage.',
    inputSchema: executeProposalSchema,
    execute: async ({ context, runtime }: { context: ExecuteProposalInput; runtime?: { userId?: string } }) => {
      const deps = await resolveDependencies(userId, runtime)
      const result = await executeMergeData(context, deps)
      return result
    },
  })

  return {
    proposePartSplit: proposePartSplitTool,
    proposePartMerge: proposePartMergeTool,
    approveProposal: approveProposalTool,
    rejectProposal: rejectProposalTool,
    executeSplit: executeSplitTool,
    executeMerge: executeMergeTool,
  }
}

export type ProposalTools = ReturnType<typeof createProposalTools>
