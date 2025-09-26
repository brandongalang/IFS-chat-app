import { createTool } from '@mastra/core'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PartRow } from '../../lib/types/database'
import { DatabaseActionLogger } from '../../lib/database/action-logger'

const splitChildSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().optional(),
  age: z.number().min(0).max(100).optional(),
  evidenceIds: z.array(z.string()).optional().default([])
})

const proposePartSplitSchema = z.object({
  userId: z.string().uuid(),
  parentPartId: z.string().uuid(),
  children: z.array(splitChildSchema).min(2),
  rationale: z.string().min(3).max(2000),
  idempotencyKey: z.string().min(8).max(128).optional()
})

const proposePartMergeSchema = z.object({
  userId: z.string().uuid(),
  partIds: z.array(z.string().uuid()).min(2),
  canonicalName: z.string().min(1).max(100),
  rationale: z.string().min(3).max(2000),
  idempotencyKey: z.string().min(8).max(128).optional()
})

const approveRejectSchema = z.object({
  userId: z.string().uuid(),
  proposalId: z.string().uuid(),
  approvedBy: z.string().min(1),
})

async function proposePartSplit(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof proposePartSplitSchema>,
) {
  const { error, data } = await supabase
    .from('part_change_proposals')
    .insert({
      user_id: input.userId,
      type: 'split',
      payload: {
        parentPartId: input.parentPartId,
        children: input.children
      },
      rationale: input.rationale,
      idempotency_key: input.idempotencyKey
    })
    .select('*')
    .single()

  if (error) {
    const isIdem = (error as any)?.message?.includes('uq_part_change_proposals_idem')
    if (!isIdem) return { success: false, error: `Failed to propose split: ${error.message}` }
  }

  return { success: true, data }
}

async function proposePartMerge(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof proposePartMergeSchema>,
) {
  const { error, data } = await supabase
    .from('part_change_proposals')
    .insert({
      user_id: input.userId,
      type: 'merge',
      payload: {
        partIds: input.partIds,
        canonicalName: input.canonicalName
      },
      rationale: input.rationale,
      idempotency_key: input.idempotencyKey
    })
    .select('*')
    .single()

  if (error) {
    const isIdem = (error as any)?.message?.includes('uq_part_change_proposals_idem')
    if (!isIdem) return { success: false, error: `Failed to propose merge: ${error.message}` }
  }

  return { success: true, data }
}

async function approveProposal(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof approveRejectSchema>,
) {
  const { data: proposal, error } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', input.proposalId)
    .eq('user_id', input.userId)
    .single()

  if (error || !proposal) {
    return { success: false, error: 'Proposal not found' }
  }

  if (proposal.status !== 'pending') {
    return { success: false, error: `Proposal is not pending (status: ${proposal.status})` }
  }

  const { error: updErr, data: updated } = await supabase
    .from('part_change_proposals')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: input.approvedBy })
    .eq('id', input.proposalId)
    .select('*')
    .single()

  if (updErr) return { success: false, error: `Failed to approve: ${updErr.message}` }

  return { success: true, data: updated }
}

async function rejectProposal(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof approveRejectSchema>,
) {
  const { data: proposal, error } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', input.proposalId)
    .eq('user_id', input.userId)
    .single()

  if (error || !proposal) {
    return { success: false, error: 'Proposal not found' }
  }

  if (proposal.status !== 'pending') {
    return { success: false, error: `Proposal is not pending (status: ${proposal.status})` }
  }

  const { error: updErr, data: updated } = await supabase
    .from('part_change_proposals')
    .update({ status: 'rejected', approved_at: new Date().toISOString(), approved_by: input.approvedBy })
    .eq('id', input.proposalId)
    .select('*')
    .single()

  if (updErr) return { success: false, error: `Failed to reject: ${updErr.message}` }

  return { success: true, data: updated }
}

// Execute helpers
async function executeSplit(
  supabase: SupabaseClient<Database>,
  userId: string,
  proposalId: string,
) {
  const logger = new DatabaseActionLogger(supabase)
  // Fetch proposal
  const { data: proposal } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', proposalId)
    .eq('user_id', userId)
    .single()

  if (!proposal || proposal.type !== 'split') throw new Error('Invalid split proposal')
  const payload = proposal.payload as any

  // Fetch parent
  const { data: parent, error: parentErr } = await supabase
    .from('parts')
    .select('*')
    .eq('id', payload.parentPartId)
    .eq('user_id', userId)
    .single()
  if (parentErr || !parent) throw new Error('Parent part not found')

  // Create children parts
  const now = new Date().toISOString()
  const inserts = (payload.children as Array<any>).map((c: any) => ({
    user_id: userId,
    name: c.name,
    status: 'emerging',
    category: parent.category,
    age: c.age ?? null,
    role: c.role ?? null,
    triggers: parent.triggers ?? [],
    emotions: parent.emotions ?? [],
    beliefs: parent.beliefs ?? [],
    somatic_markers: parent.somatic_markers ?? [],
    confidence: Math.max(0, Math.min(1, parent.confidence - 0.1)),
    evidence_count: 0,
    recent_evidence: [],
    story: {
      ...(parent.story || {}),
      evolution: [
        ...((parent.story?.evolution) || []),
        { timestamp: now, change: `Split from ${parent.name}`, trigger: 'Split execution' }
      ]
    },
    relationships: parent.relationships || {},
    visualization: parent.visualization || { emoji: '🤗', color: '#6B7280', energyLevel: 0.5 },
    first_noticed: parent.first_noticed,
    acknowledged_at: null,
    last_active: now,
    created_at: now,
    updated_at: now
  }))

  const { data: children, error: childErr } = await supabase
    .from('parts')
    .insert(inserts)
    .select('*')
  if (childErr) throw childErr

  // Update parent lineage in relationships JSON (non-destructive)
  const relationships = parent.relationships || {}
  const lineage = { ...(relationships.lineage || {}) }
  lineage['superseded_by'] = [...(lineage['superseded_by'] || []), ...children.map((c: PartRow) => c.id)]
  const updatedParent = await logger.loggedUpdate<PartRow>(
    'parts',
    parent.id,
    { relationships: { ...relationships, lineage }, updated_at: now },
    userId,
    'update_part_attributes',
    { partName: parent.name, changeDescription: 'Updated lineage after split' }
  )

  // Mark proposal executed
  const { error: execErr } = await supabase
    .from('part_change_proposals')
    .update({ status: 'executed', executed_at: now, executed_by: 'agent' })
    .eq('id', proposalId)
  if (execErr) throw execErr

  return { parent: updatedParent, children }
}

async function executeMerge(
  supabase: SupabaseClient<Database>,
  userId: string,
  proposalId: string,
) {
  const logger = new DatabaseActionLogger(supabase)
  const { data: proposal } = await supabase
    .from('part_change_proposals')
    .select('*')
    .eq('id', proposalId)
    .eq('user_id', userId)
    .single()
  if (!proposal || proposal.type !== 'merge') throw new Error('Invalid merge proposal')
  const payload = proposal.payload as any

  // Fetch all parts
  const { data: parts, error: partsErr } = await supabase
    .from('parts')
    .select('*')
    .eq('user_id', userId)
    .in('id', payload.partIds)
  if (partsErr || !parts || parts.length < 2) throw new Error('Parts not found for merge')

  // Choose canonical
  const canonical = parts[0]
  const now = new Date().toISOString()

  // Update canonical name if needed
  const updatedCanonical = await logger.loggedUpdate<PartRow>(
    'parts',
    canonical.id,
    { name: payload.canonicalName, updated_at: now },
    userId,
    'update_part_attributes',
    { partName: canonical.name, changeDescription: `Renamed to ${payload.canonicalName} during merge` }
  )

  // Mark others as superseded by canonical
  for (const p of parts.slice(1)) {
    const relationships = p.relationships || {}
    const lineage = { ...(relationships.lineage || {}) }
    lineage['superseded_by'] = [...(lineage['superseded_by'] || []), updatedCanonical.id]
    await logger.loggedUpdate<PartRow>(
      'parts',
      p.id,
      { relationships: { ...relationships, lineage }, updated_at: now },
      userId,
      'update_part_attributes',
      { partName: p.name, changeDescription: `Superseded by ${payload.canonicalName}` }
    )
  }

  // Mark proposal executed
  const { error: execErr } = await supabase
    .from('part_change_proposals')
    .update({ status: 'executed', executed_at: now, executed_by: 'agent' })
    .eq('id', proposalId)
  if (execErr) throw execErr

  return { canonical: updatedCanonical, merged: parts.slice(1) }
}

const proposePartSplitTool = createTool({
  id: 'proposePartSplit',
  description: 'Create a proposal to split a parent part into multiple child parts. No data is mutated until approval.',
  inputSchema: proposePartSplitSchema,
  execute: async ({ context }) => {
    const { supabase, ...input } = context as z.infer<typeof proposePartSplitSchema> & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to proposal tool context')
    }

    const result = await proposePartSplit(supabase, input)
    if (!result.success) throw new Error(result.error)
    return result.data
  }
})

const proposePartMergeTool = createTool({
  id: 'proposePartMerge',
  description: 'Create a proposal to merge multiple parts into a canonical part. No data is mutated until approval.',
  inputSchema: proposePartMergeSchema,
  execute: async ({ context }) => {
    const { supabase, ...input } = context as z.infer<typeof proposePartMergeSchema> & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to proposal tool context')
    }

    const result = await proposePartMerge(supabase, input)
    if (!result.success) throw new Error(result.error)
    return result.data
  }
})

const approveProposalTool = createTool({
  id: 'approveProposal',
  description: 'Approve a pending proposal (split or merge). Does not execute the mutation yet.',
  inputSchema: approveRejectSchema,
  execute: async ({ context }) => {
    const { supabase, ...input } = context as z.infer<typeof approveRejectSchema> & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to proposal tool context')
    }

    const result = await approveProposal(supabase, input)
    if (!result.success) throw new Error(result.error)
    return result.data
  }
})

const rejectProposalTool = createTool({
  id: 'rejectProposal',
  description: 'Reject a pending proposal (split or merge).',
  inputSchema: approveRejectSchema,
  execute: async ({ context }) => {
    const { supabase, ...input } = context as z.infer<typeof approveRejectSchema> & {
      supabase?: SupabaseClient<Database>
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to proposal tool context')
    }

    const result = await rejectProposal(supabase, input)
    if (!result.success) throw new Error(result.error)
    return result.data
  }
})

const executeSplitTool = createTool({
  id: 'executeSplit',
  description: 'Execute an approved split proposal. Mutates data and updates lineage.',
  inputSchema: z.object({ userId: z.string().uuid(), proposalId: z.string().uuid() }),
  execute: async ({ context }) => {
    const { supabase, userId, proposalId } = context as {
      supabase?: SupabaseClient<Database>
      userId: string
      proposalId: string
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to proposal tool context')
    }

    const result = await executeSplit(supabase, userId, proposalId)
    return result
  }
})

const executeMergeTool = createTool({
  id: 'executeMerge',
  description: 'Execute an approved merge proposal. Mutates data and updates lineage.',
  inputSchema: z.object({ userId: z.string().uuid(), proposalId: z.string().uuid() }),
  execute: async ({ context }) => {
    const { supabase, userId, proposalId } = context as {
      supabase?: SupabaseClient<Database>
      userId: string
      proposalId: string
    }

    if (!supabase) {
      throw new Error('Supabase client not provided to proposal tool context')
    }

    const result = await executeMerge(supabase, userId, proposalId)
    return result
  }
})

export const proposalTools = {
  proposePartSplit: proposePartSplitTool,
  proposePartMerge: proposePartMergeTool,
  approveProposal: approveProposalTool,
  rejectProposal: rejectProposalTool,
  executeSplit: executeSplitTool,
  executeMerge: executeMergeTool,
}
